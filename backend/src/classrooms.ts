import { Router } from "express";
import { z } from "zod";
import { query, tx } from "./db.js";
import { active, fail, role } from "./core.js";
import { notifyMeeting } from "./course-mail.js";

export const classrooms = Router();

classrooms.use(
  "/classrooms",
  active,
  role("tutor", "student"),
);

const postSchema = z
  .object({
    kind: z.enum([
      "announcement",
      "material",
      "meeting",
    ]),
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(3).max(6000),
    url: z
      .string()
      .trim()
      .max(2000)
      .default("")
      .refine((value) => {
        if (!value) return true;

        try {
          const url = new URL(value);

          return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      }, "Utiliza un enlace HTTPS válido"),
  })
  .refine(
    (post) => post.kind === "announcement" || !!post.url,
    {
      path: ["url"],
      message:
        "Agrega el enlace del material o de la clase virtual",
    },
  );

async function access(
  id: string,
  userId: string,
  userRole: string,
  write = false,
) {
  const course = (
    await query(
      `SELECT
         o.id,
         o.title,
         o.tutor_id,
         o.modalities,
         u.approved,
         u.suspended,
         EXISTS(
           SELECT 1
           FROM subscriptions sub
           WHERE sub.offer_id=o.id
             AND sub.student_id=$2
             AND sub.status='approved'
         ) AS enrolled
       FROM offers o
       JOIN users u ON u.id=o.tutor_id
       WHERE o.id=$1`,
      [id, userId],
    )
  ).rows[0];

  if (!course) {
    fail(404, "Tutoría no encontrada");
  }

  if (!course.approved || course.suspended) {
    fail(403, "Tutor no disponible");
  }

  const owner =
    userRole === "tutor" &&
    course.tutor_id === userId;

  if (
    write
      ? !owner
      : !(
          owner ||
          (userRole === "student" && course.enrolled)
        )
  ) {
    fail(
      403,
      "Solo el tutor y los estudiantes con inscripción aprobada pueden acceder",
    );
  }

  return course;
}

classrooms.get("/classrooms", async (req, res) => {
  const result = await query(
    `SELECT
       o.id,
       o.title,
       o.modalities,
       u.name AS tutor_name
     FROM offers o
     JOIN users u ON u.id=o.tutor_id
     WHERE u.approved
       AND NOT u.suspended
       AND (
         ($2='tutor' AND o.tutor_id=$1)
         OR
         (
           $2='student'
           AND EXISTS(
             SELECT 1
             FROM subscriptions sub
             WHERE sub.offer_id=o.id
               AND sub.student_id=$1
               AND sub.status='approved'
           )
         )
       )
     ORDER BY o.title,o.id`,
    [req.user.id, req.user.role],
  );

  res.json(result.rows);
});

classrooms.get(
  "/classrooms/:id/posts",
  async (req, res) => {
    console.log(
      "[tablero] Consultando publicaciones en el backend local",
    );

    const id = z.string().uuid().parse(req.params.id);

    await access(id, req.user.id, req.user.role);

    res.json(
      (
        await query(
          `SELECT
             id,kind,title,body,url,created_at,updated_at
           FROM course_posts
           WHERE offer_id=$1
           ORDER BY created_at DESC,id`,
          [id],
        )
      ).rows,
    );
  },
);

classrooms.post(
  "/classrooms/:id/posts",
  role("tutor"),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const body = postSchema.parse(req.body);

    const course = await access(
      id,
      req.user.id,
      req.user.role,
      true,
    );

    if (
      body.kind === "meeting" &&
      !course.modalities.includes("virtual")
    ) {
      fail(400, "Esta tutoría no ofrece modalidad virtual");
    }

    const result = await query(
      `INSERT INTO course_posts(
         offer_id,kind,title,body,url
       )
       VALUES($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        id,
        body.kind,
        body.title,
        body.body,
        body.url,
      ],
    );

    const post = result.rows[0];

    const email =
      post.kind === "meeting"
        ? await notifyMeeting(post.id)
        : null;

    res.status(201).json({
      ...post,
      email,
      warning: email?.error
        ? "La publicación se guardó, pero no se confirmaron todos los correos."
        : null,
    });
  },
);

classrooms.put(
  "/classrooms/:id/posts/:postId",
  role("tutor"),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const postId = z.string().uuid().parse(req.params.postId);
    const body = postSchema.parse(req.body);

    const course = await access(
      id,
      req.user.id,
      req.user.role,
      true,
    );

    if (
      body.kind === "meeting" &&
      !course.modalities.includes("virtual")
    ) {
      fail(400, "Esta tutoría no ofrece modalidad virtual");
    }

    const updated = await tx(async (client) => {
      const previous = (
        await client.query(
          `SELECT kind,url
           FROM course_posts
           WHERE id=$1 AND offer_id=$2
           FOR UPDATE`,
          [postId, id],
        )
      ).rows[0];

      if (!previous) {
        fail(404, "Publicación no encontrada");
      }

      const result = await client.query(
        `UPDATE course_posts
         SET kind=$3,
             title=$4,
             body=$5,
             url=$6,
             updated_at=now()
         WHERE id=$1 AND offer_id=$2
         RETURNING *`,
        [
          postId,
          id,
          body.kind,
          body.title,
          body.body,
          body.url,
        ],
      );

      return {
        post: result.rows[0],
        notify:
          body.kind === "meeting" &&
          (
            previous.kind !== "meeting" ||
            previous.url !== body.url
          ),
      };
    });

console.log("[correo] Publicación editada:", {
  tipo: updated.post.kind,
  debeNotificar: updated.notify,
});

const email = updated.notify
  ? await notifyMeeting(postId)
  : null;

console.log("[correo] Resultado:", email);

    res.json({
      ...updated.post,
      email,
      warning: email?.error
        ? "Los cambios se guardaron, pero no se confirmaron todos los correos."
        : null,
    });
  },
);

classrooms.delete(
  "/classrooms/:id/posts/:postId",
  role("tutor"),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const postId = z.string().uuid().parse(req.params.postId);

    await access(
      id,
      req.user.id,
      req.user.role,
      true,
    );

    const result = await query(
      `DELETE FROM course_posts
       WHERE id=$1 AND offer_id=$2
       RETURNING id`,
      [postId, id],
    );

    if (!result.rowCount) {
      fail(404, "Publicación no encontrada");
    }

    res.status(204).end();
  },
);