import { Router } from "express";
import { z } from "zod";
import { query, tx } from "./db.js";
import { active, role, fail } from "./core.js";
import { kmBetween } from "./rules.js";
import { classrooms } from "./classrooms.js";
export const catalog = Router();
catalog.get("/categories", async (req, res) => {
  if (req.user.suspended) fail(403, "ACCOUNT_SUSPENDED");
  res.json(
    (
      await query(
        "SELECT c.* FROM categories c LEFT JOIN categories p ON p.id=c.parent_id WHERE c.active AND (p.id IS NULL OR p.active) ORDER BY c.name",
      )
    ).rows,
  );
});
catalog.use(active);
catalog.use(classrooms);
const offerSchema = z.object({
  category_id: z.string().uuid(),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(2000),
  modalities: z.array(z.enum(["virtual", "tutor_home", "student_home"])).min(1),
  hourly_rate: z.number().positive().max(100000),
  km_rate: z.number().min(0).max(10000),
  active: z.boolean().default(true),
});
catalog.get("/offers/mine", role("tutor"), async (req, res) =>
  res.json(
    (await query("SELECT * FROM offers WHERE tutor_id=$1", [req.user.id])).rows,
  ),
);
catalog.post("/offers", role("tutor"), async (req, res) => {
  if (!req.user.approved) fail(403, "El administrador debe aprobar tu perfil");
  const b = offerSchema.parse(req.body);
  if (
    !(
      await query(
        "SELECT c.id FROM categories c LEFT JOIN categories p ON p.id=c.parent_id WHERE c.id=$1 AND c.active AND (p.id IS NULL OR p.active)",
        [b.category_id],
      )
    ).rowCount
  )
    fail(400, "Categoría no disponible");
  res
    .status(201)
    .json(
      (
        await query(
          "INSERT INTO offers(tutor_id,category_id,title,description,modalities,hourly_rate,km_rate,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            req.user.id,
            b.category_id,
            b.title,
            b.description,
            JSON.stringify(b.modalities),
            b.hourly_rate,
            b.km_rate,
            b.active,
          ],
        )
      ).rows[0],
    );
});
catalog.put("/offers/:id", role("tutor"), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const b = offerSchema.parse(req.body);
  if (!req.user.approved) fail(403, "Tutor no aprobado");
  if (
    !(
      await query(
        "SELECT c.id FROM categories c LEFT JOIN categories p ON p.id=c.parent_id WHERE c.id=$1 AND c.active AND (p.id IS NULL OR p.active)",
        [b.category_id],
      )
    ).rowCount
  )
    fail(400, "Categoría no disponible");
  const r = await query(
    "UPDATE offers SET category_id=$3,title=$4,description=$5,modalities=$6,hourly_rate=$7,km_rate=$8,active=$9 WHERE id=$1 AND tutor_id=$2 RETURNING *",
    [
      id,
      req.user.id,
      b.category_id,
      b.title,
      b.description,
      JSON.stringify(b.modalities),
      b.hourly_rate,
      b.km_rate,
      b.active,
    ],
  );
  if (!r.rowCount) fail(404, "Oferta no encontrada");
  res.json(r.rows[0]);
});
catalog.get("/offers", async (req, res) => {
  const q = z
    .object({
      category: z.string().uuid().optional(),
      modality: z.enum(["virtual", "tutor_home", "student_home"]).optional(),
      min: z.coerce.number().min(0).default(0),
      max: z.coerce.number().min(0).default(100000),
      rating: z.coerce.number().min(0).max(5).default(0),
      reviews: z.coerce.number().int().min(0).default(0),
      radius: z.coerce.number().positive().optional(),
    })
    .parse(req.query);
  const rows = (
    await query(
      `SELECT o.*,u.name,u.picture,u.bio,u.lat,u.lng,c.name category,COALESCE(r.rating,0)::float rating,COALESCE(r.review_count,0)::int review_count FROM offers o JOIN users u ON u.id=o.tutor_id JOIN categories c ON c.id=o.category_id LEFT JOIN categories p ON p.id=c.parent_id LEFT JOIN (SELECT tutor_id,avg(stars) rating,count(*) review_count FROM reviews GROUP BY tutor_id) r ON r.tutor_id=u.id WHERE o.active AND u.approved AND NOT u.suspended AND c.active AND (p.id IS NULL OR p.active) AND ($1::uuid IS NULL OR c.id=$1 OR c.parent_id=$1) AND ($2::text IS NULL OR o.modalities ? $2) AND o.hourly_rate BETWEEN $3 AND $4 AND COALESCE(r.rating,0)>=$5 AND COALESCE(r.review_count,0)>=$6`,
      [
        q.category || null,
        q.modality || null,
        q.min,
        q.max,
        q.rating,
        q.reviews,
      ],
    )
  ).rows
    .map((o) => {
      const distance = kmBetween(req.user, { lat: o.lat, lng: o.lng });
      const { lat, lng, ...safe } = o;
      return { ...safe, distance_km: distance };
    })
    .filter((o) => !q.radius || o.distance_km <= q.radius);
  res.json(rows);
});
catalog.get("/tutors/:id/reviews", async (req, res) =>
  res.json(
    (
      await query(
        "SELECT r.stars,r.comment,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.student_id WHERE tutor_id=$1 ORDER BY r.created_at DESC",
        [z.string().uuid().parse(req.params.id)],
      )
    ).rows,
  ),
);
catalog.get("/availability/:id", async (req, res) =>
  res.json(
    (
      await query(
        "SELECT weekday,start_min,end_min FROM availability WHERE tutor_id=$1 ORDER BY weekday,start_min",
        [z.string().uuid().parse(req.params.id)],
      )
    ).rows,
  ),
);
catalog.put("/availability", role("tutor"), async (req, res) => {
  const b = z
    .array(
      z
        .object({
          weekday: z.number().int().min(0).max(6),
          start_min: z.number().int().min(0).max(1439),
          end_min: z.number().int().min(1).max(1440),
        })
        .refine((x) => x.end_min > x.start_min, "Hora final inválida"),
    )
    .max(40)
    .parse(req.body);
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++)
      if (
        b[i].weekday === b[j].weekday &&
        b[i].start_min < b[j].end_min &&
        b[j].start_min < b[i].end_min
      )
        fail(400, "Bloques de disponibilidad superpuestos");
  await tx(async (c) => {
    await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [req.user.id]);
    await c.query("DELETE FROM availability WHERE tutor_id=$1", [req.user.id]);
    for (const x of b)
      await c.query(
        "INSERT INTO availability(tutor_id,weekday,start_min,end_min) VALUES($1,$2,$3,$4)",
        [req.user.id, x.weekday, x.start_min, x.end_min],
      );
  });
  res.json({
    message: "Disponibilidad guardada. Las reservas existentes se conservan.",
  });
});
