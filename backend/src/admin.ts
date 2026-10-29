import { Router } from "express";
import { z } from "zod";
import { query, tx } from "./db.js";
import { role, fail, safeUser, decrypt, audit } from "./core.js";
export const moderation = Router();
moderation.get("/contacts", async (req, res) =>
  res.json(
    (
      await query(
        `SELECT id,name FROM users WHERE id IN (SELECT tutor_id FROM conversations WHERE student_id=$1 UNION SELECT student_id FROM conversations WHERE tutor_id=$1 UNION SELECT tutor_id FROM sessions WHERE student_id=$1 UNION SELECT student_id FROM sessions WHERE tutor_id=$1) ORDER BY name`,
        [req.user.id],
      )
    ).rows,
  ),
);
moderation.post("/reports", async (req, res) => {
  const b = z
    .object({
      target_id: z.string().uuid(),
      reason: z.enum([
        "inasistencia",
        "conducta inapropiada",
        "cobros indebidos",
      ]),
      evidence: z.string().trim().min(20).max(4000),
    })
    .parse(req.body);
  if (b.target_id === req.user.id) fail(400, "No puedes denunciarte");
  res
    .status(201)
    .json(
      (
        await query(
          "INSERT INTO reports(reporter_id,target_id,reason,evidence) VALUES($1,$2,$3,$4) RETURNING *",
          [req.user.id, b.target_id, b.reason, b.evidence],
        )
      ).rows[0],
    );
});
moderation.get("/reports/mine", async (req, res) =>
  res.json(
    (
      await query(
        "SELECT * FROM reports WHERE reporter_id=$1 ORDER BY created_at DESC",
        [req.user.id],
      )
    ).rows,
  ),
);
export const admin = Router();
admin.use(role("admin"));
admin.get("/users/:id/subscriptions", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);

  const student = (
    await query(
      "SELECT id,name,email FROM users WHERE id=$1 AND role='student'",
      [id],
    )
  ).rows[0];

  if (!student) fail(404, "Estudiante no encontrado");

  const subscriptions = (
    await query(
      `SELECT
         sub.id,
         sub.weeks,
         sub.modality,
         sub.status,
         sub.created_at,
         sub.class_cost,
         sub.travel_cost,
         o.title,
         u.name AS tutor_name,
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object(
               'id',s.id,
               'start_at',s.start_at,
               'end_at',s.end_at,
               'status',s.status,
               'absence_party',s.absence_party,
               'absence_details',s.absence_details
             )
             ORDER BY s.start_at,s.id
           )
           FROM sessions s
           WHERE s.subscription_id=sub.id
             AND s.student_id=$1
         ),'[]'::jsonb) AS sessions
       FROM subscriptions sub
       JOIN offers o ON o.id=sub.offer_id
       JOIN users u ON u.id=o.tutor_id
       WHERE sub.student_id=$1
       ORDER BY sub.created_at DESC,sub.id`,
      [id],
    )
  ).rows;

  res.json({ student, subscriptions });
});
admin.get("/users", async (_req, res) =>
  res.json(
    (await query("SELECT * FROM users ORDER BY created_at DESC")).rows.map(
      safeUser,
    ),
  ),
);
admin.get("/users/:id/document", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const u = (await query("SELECT document_cipher FROM users WHERE id=$1", [id]))
    .rows[0];
  if (!u?.document_cipher) fail(404, "Documento no disponible");
  await audit(req.user.id, "document.viewed", id);
  res.json({ document: decrypt(u.document_cipher) });
});
admin.patch("/users/:id/approve", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  await tx(async (c) => {
    if (
      !(
        await c.query(
          "UPDATE users SET approved=true,updated_at=now() WHERE id=$1 AND role='tutor' AND onboarding RETURNING id",
          [id],
        )
      ).rowCount
    )
      fail(400, "Tutor no encontrado o perfil incompleto");
    await c.query(
      "INSERT INTO audit(actor_id,action,target) VALUES($1,$2,$3)",
      [req.user.id, "tutor.approved", id],
    );
  });
  res.json({ message: "Tutor aprobado" });
});
admin.post("/users/:id/suspend", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const b = z
    .object({ reason: z.string().trim().min(10).max(2000) })
    .parse(req.body);
  await tx(async (c) => {
    if (
      !(
        await c.query(
          "UPDATE users SET suspended=true,suspension_reason=$2,suspended_at=now(),updated_at=now() WHERE id=$1 AND role<>'admin' AND NOT suspended RETURNING id",
          [id, b.reason],
        )
      ).rowCount
    )
      fail(400, "Cuenta no disponible para suspensión");
    await c.query(
      "INSERT INTO audit(actor_id,action,target,detail) VALUES($1,$2,$3,$4)",
      [req.user.id, "user.suspended", id, JSON.stringify(b)],
    );
  });
  req.app
    .get("io")
    ?.to("user:" + id)
    .emit("account:changed");
  req.app
    .get("io")
    ?.in("user:" + id)
    .disconnectSockets(true);
  res.json({ message: "Cuenta suspendida" });
});
admin.get("/categories", async (_req, res) =>
  res.json((await query("SELECT * FROM categories ORDER BY name")).rows),
);
const cat = z.object({
  name: z.string().trim().min(2).max(100),
  parent_id: z.string().uuid().nullable(),
  active: z.boolean(),
});
admin.post("/categories", async (req, res) => {
  const b = cat.parse(req.body);
  if (
    b.parent_id &&
    !(
      await query(
        "SELECT id FROM categories WHERE id=$1 AND parent_id IS NULL",
        [b.parent_id],
      )
    ).rowCount
  )
    fail(400, "Selecciona una categoría principal");
  res
    .status(201)
    .json(
      (
        await query(
          "INSERT INTO categories(name,parent_id,active) VALUES($1,$2,$3) RETURNING *",
          [b.name, b.parent_id, b.active],
        )
      ).rows[0],
    );
});
admin.put("/categories/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const b = cat.parse(req.body);
  await tx(async (c) => {
    await c.query("LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE");
    if (
      b.parent_id &&
      (b.parent_id === id ||
        !(
          await c.query(
            "SELECT id FROM categories WHERE id=$1 AND parent_id IS NULL",
            [b.parent_id],
          )
        ).rowCount ||
        (await c.query("SELECT id FROM categories WHERE parent_id=$1", [id]))
          .rowCount)
    )
      fail(400, "Solo se permite categoría y subcategoría sin ciclos");
    if (
      !(
        await c.query(
          "UPDATE categories SET name=$2,parent_id=$3,active=$4 WHERE id=$1 RETURNING id",
          [id, b.name, b.parent_id, b.active],
        )
      ).rowCount
    )
      fail(404, "Categoría no encontrada");
  });
  res.json({ message: "Categoría actualizada" });
});
admin.delete("/categories/:id", async (req, res) => {
  if (
    !(
      await query("DELETE FROM categories WHERE id=$1 RETURNING id", [
        z.string().uuid().parse(req.params.id),
      ])
    ).rowCount
  )
    fail(404, "Categoría no encontrada");
  res.status(204).end();
});
admin.get("/reports", async (req, res) =>
  res.json(
    (
      await query(
        "SELECT r.*,u.name reporter_name,v.name target_name FROM reports r JOIN users u ON u.id=r.reporter_id JOIN users v ON v.id=r.target_id WHERE ($1::uuid IS NULL OR r.target_id=$1) ORDER BY r.created_at DESC",
        [req.query.user ? z.string().uuid().parse(req.query.user) : null],
      )
    ).rows,
  ),
);
admin.patch("/reports/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const b = z
    .object({ resolution: z.string().trim().min(10).max(2000) })
    .parse(req.body);
  await tx(async (c) => {
    if (
      !(
        await c.query(
          "UPDATE reports SET status='closed',resolution=$2 WHERE id=$1 AND status='open' RETURNING id",
          [id, b.resolution],
        )
      ).rowCount
    )
      fail(409, "Denuncia no disponible");
    await c.query(
      "INSERT INTO audit(actor_id,action,target,detail) VALUES($1,$2,$3,$4)",
      [req.user.id, "report.closed", id, JSON.stringify(b)],
    );
  });
  res.json({ message: "Denuncia resuelta" });
});
admin.get("/appeals", async (_req, res) =>
  res.json(
    (
      await query(
        "SELECT a.*,u.name FROM appeals a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC",
      )
    ).rows,
  ),
);
admin.patch("/appeals/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const b = z
    .object({
      status: z.enum(["accepted", "rejected"]),
      resolution: z.string().trim().min(10).max(2000),
    })
    .parse(req.body);
  await tx(async (c) => {
    const a = (
      await c.query("SELECT * FROM appeals WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!a || a.status !== "pending")
      fail(409, "Apelación ya resuelta o inexistente");
    await c.query("UPDATE appeals SET status=$2,resolution=$3 WHERE id=$1", [
      id,
      b.status,
      b.resolution,
    ]);
    if (b.status === "accepted")
      await c.query(
        "UPDATE users SET suspended=false,updated_at=now() WHERE id=$1",
        [a.user_id],
      );
    await c.query(
      "INSERT INTO audit(actor_id,action,target,detail) VALUES($1,$2,$3,$4)",
      [req.user.id, "appeal." + b.status, a.user_id, JSON.stringify(b)],
    );
  });
  res.json({ message: "Apelación resuelta" });
});
admin.get("/audit", async (_req, res) =>
  res.json(
    (await query("SELECT * FROM audit ORDER BY created_at DESC LIMIT 300"))
      .rows,
  ),
);
admin.get("/analytics", async (req, res) => {
  const month = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .parse(req.query.month);
  const start = month + "-01T00:00:00-06:00";
  const rankings = (
    await query(
      `SELECT u.id,u.name,avg(r.stars)::float rating,count(r.id)::int reviews FROM users u JOIN reviews r ON r.tutor_id=u.id GROUP BY u.id ORDER BY rating DESC,reviews DESC`,
    )
  ).rows;
  const demand = (
    await query(
      `SELECT c.name,COALESCE(sum(extract(epoch FROM(s.end_at-s.start_at))/3600) FILTER(WHERE s.status IN ('approved','completed')),0)::float hours FROM categories c LEFT JOIN offers o ON o.category_id=c.id LEFT JOIN subscriptions sub ON sub.offer_id=o.id LEFT JOIN sessions s ON s.subscription_id=sub.id AND s.start_at>=$1::timestamptz AND s.start_at<($1::timestamptz+interval '1 month') GROUP BY c.id ORDER BY hours DESC`,
      [start],
    )
  ).rows;
  const sessions = (
    await query(
      `SELECT status,count(*)::int total FROM sessions WHERE start_at>=$1::timestamptz AND start_at<($1::timestamptz+interval '1 month') GROUP BY status`,
      [start],
    )
  ).rows;
  res.json({ rankings, demand, sessions });
});