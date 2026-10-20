import { Router } from "express";
import { z } from "zod";
import { query, tx } from "./db.js";
import { env } from "./config.js";
import { fail, role } from "./core.js";
import { recurring, fits } from "./rules.js";
import { availableTimes } from "./available-times.js";
import { notifyEnrollment } from "./course-mail.js";

export const bookings = Router();

bookings.use(availableTimes);

const schema = z
  .object({
    offer_id: z.string().uuid(),
    modality: z.enum([
      "virtual",
      "tutor_home",
      "student_home",
    ]),
    weeks: z.union([
      z.literal(4),
      z.literal(8),
    ]),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(value + "T00:00:00Z");

        return (
          !isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      }, "Fecha inválida"),
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .transform((values) => [...new Set(values)]),
    minute: z.number().int().min(0).max(1439),
    duration: z.number().int().min(30).max(480),
  })
  .refine(
    (value) => value.minute + value.duration <= 1440,
    "La sesión debe terminar el mismo día",
  );

async function price(
  offerId: string,
  studentId: string,
  modality: string,
) {
  const o = (
    await query(
      `SELECT
         o.*,
         u.lat,
         u.lng,
         u.approved,
         u.suspended,
         c.active AS category_active,
         p.active AS parent_active
       FROM offers o
       JOIN users u ON u.id=o.tutor_id
       JOIN categories c ON c.id=o.category_id
       LEFT JOIN categories p ON p.id=c.parent_id
       WHERE o.id=$1`,
      [offerId],
    )
  ).rows[0];

  if (
    !o ||
    !o.active ||
    !o.approved ||
    o.suspended ||
    !o.category_active ||
    o.parent_active === false
  ) {
    fail(404, "Oferta no disponible");
  }

  if (!o.modalities.includes(modality)) {
    fail(400, "Modalidad no admitida");
  }

  if (o.tutor_id === studentId) {
    fail(400, "No puedes contratarte");
  }

  let distance = 0;
  let route: null | number[][] = null;

  if (modality === "student_home") {
    const u = (
      await query(
        "SELECT lat,lng FROM users WHERE id=$1",
        [studentId],
      )
    ).rows[0];

    let response: globalThis.Response;

    try {
      response = await fetch(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        {
          method: "POST",
          headers: {
            Authorization: env.ORS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coordinates: [
              [o.lng, o.lat],
              [u.lng, u.lat],
            ],
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      fail(
        503,
        "No se pudo calcular la ruta. Intenta nuevamente",
      );
    }

    if (!response.ok) {
      fail(
        503,
        "El proveedor de rutas no está disponible para estos puntos",
      );
    }

    const data = (await response.json()) as {
      features?: {
        properties: {
          summary: {
            distance: number;
          };
        };
        geometry: {
          coordinates: number[][];
        };
      }[];
    };

    const feature = data.features?.[0];

    if (
      !feature ||
      !Number.isFinite(feature.properties.summary.distance)
    ) {
      fail(503, "No se encontró una ruta vial");
    }

    distance = feature.properties.summary.distance / 1000;
    route = feature.geometry.coordinates;
  }

  return { o, distance, route };
}

bookings.post(
  "/quote",
  role("student"),
  async (req, res) => {
    const body = schema.parse(req.body);

    const { o, distance, route } = await price(
      body.offer_id,
      req.user.id,
      body.modality,
    );

    const slots = recurring(
      body.start_date,
      body.weeks,
      body.days,
      body.minute,
      body.duration,
    );

    if (
      !slots.length ||
      new Date(slots[0].start) <= new Date()
    ) {
      fail(400, "Selecciona fechas futuras");
    }

    const class_cost =
      ((Number(o.hourly_rate) * body.duration) / 60) *
      slots.length;

    const travel_cost =
      distance * Number(o.km_rate) * slots.length;

    res.json({
      sessions: slots.length,
      distance_km: distance,
      class_cost,
      travel_cost,
      total: class_cost + travel_cost,
      route,
      notice:
        "Traslado de ida por sesión. La reserva recalcula precio y disponibilidad.",
    });
  },
);

bookings.post(
  "/subscriptions",
  role("student"),
  async (req, res) => {
    const body = schema.parse(req.body);

    const priced = await price(
      body.offer_id,
      req.user.id,
      body.modality,
    );

    const slots = recurring(
      body.start_date,
      body.weeks,
      body.days,
      body.minute,
      body.duration,
    );

    if (
      !slots.length ||
      new Date(slots[0].start) <= new Date() ||
      new Date(slots[0].start).getTime() >
        Date.now() + 366 * 86400000
    ) {
      fail(
        400,
        "La primera sesión debe ser futura y dentro de un año",
      );
    }

    const result = await tx(async (client) => {
      const people = (
        await client.query(
          `SELECT *
           FROM users
           WHERE id=ANY($1::uuid[])
           ORDER BY id
           FOR UPDATE`,
          [[req.user.id, priced.o.tutor_id]],
        )
      ).rows;

      if (
        people.some((user) => user.suspended) ||
        !people.find(
          (user) => user.id === priced.o.tutor_id,
        )?.approved
      ) {
        fail(403, "Usuario no disponible");
      }

      const offer = (
        await client.query(
          "SELECT * FROM offers WHERE id=$1 FOR SHARE",
          [body.offer_id],
        )
      ).rows[0];

      if (
        !offer ||
        !offer.active ||
        !offer.modalities.includes(body.modality)
      ) {
        fail(409, "La oferta cambió");
      }

      const category = (
        await client.query(
          `SELECT
             c.active,
             p.active AS parent_active
           FROM categories c
           LEFT JOIN categories p ON p.id=c.parent_id
           WHERE c.id=$1`,
          [offer.category_id],
        )
      ).rows[0];

      if (
        !category ||
        !category.active ||
        category.parent_active === false
      ) {
        fail(409, "Categoría no disponible");
      }

      const availability = (
        await client.query(
          "SELECT * FROM availability WHERE tutor_id=$1",
          [offer.tutor_id],
        )
      ).rows;

      for (const slot of slots) {
        if (
          !fits(
            availability,
            slot.weekday,
            slot.minute,
            body.duration,
          )
        ) {
          fail(
            409,
            "Una sesión queda fuera de la disponibilidad semanal",
          );
        }
      }

      const class_cost =
        ((Number(offer.hourly_rate) * body.duration) / 60) *
        slots.length;

      const travel_cost =
        priced.distance *
        Number(offer.km_rate) *
        slots.length;

      const subscription = (
        await client.query(
          `INSERT INTO subscriptions(
             student_id,
             offer_id,
             weeks,
             modality,
             class_cost,
             travel_cost,
             distance_km,
             route
           )
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING *`,
          [
            req.user.id,
            offer.id,
            body.weeks,
            body.modality,
            class_cost,
            travel_cost,
            priced.distance,
            JSON.stringify(priced.route),
          ],
        )
      ).rows[0];

      for (const slot of slots) {
        const session = (
          await client.query(
            `INSERT INTO sessions(
               subscription_id,
               tutor_id,
               student_id,
               start_at,
               end_at
             )
             VALUES($1,$2,$3,$4,$5)
             RETURNING id`,
            [
              subscription.id,
              offer.tutor_id,
              req.user.id,
              slot.start,
              slot.end,
            ],
          )
        ).rows[0];

        for (
          const userId of [offer.tutor_id, req.user.id].sort()
        ) {
          await client.query(
            `INSERT INTO session_slots(
               session_id,user_id,period
             )
             VALUES($1,$2,tstzrange($3,$4,'[)'))`,
            [
              session.id,
              userId,
              slot.start,
              slot.end,
            ],
          );
        }
      }

      return subscription;
    });

    res.status(201).json(result);
  },
);

bookings.get("/sessions", async (req, res) => {
  res.json(
    (
      await query(
        `SELECT
           s.*,
           o.title,
           u.name AS tutor_name,
           v.name AS student_name,
           sub.modality,
           sub.class_cost,
           sub.travel_cost,
           sub.weeks,
           r.id AS review_id
         FROM sessions s
         JOIN subscriptions sub ON sub.id=s.subscription_id
         JOIN offers o ON o.id=sub.offer_id
         JOIN users u ON u.id=s.tutor_id
         JOIN users v ON v.id=s.student_id
         LEFT JOIN reviews r ON r.session_id=s.id
         WHERE s.tutor_id=$1 OR s.student_id=$1
         ORDER BY start_at`,
        [req.user.id],
      )
    ).rows,
  );
});

bookings.patch(
  "/subscriptions/:id",
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);

    const { status } = z
      .object({
        status: z.enum(["approved", "cancelled"]),
      })
      .parse(req.body);

    await tx(async (client) => {
      const subscription = (
        await client.query(
          `SELECT sub.*,o.tutor_id
           FROM subscriptions sub
           JOIN offers o ON o.id=sub.offer_id
           WHERE sub.id=$1
           FOR UPDATE OF sub`,
          [id],
        )
      ).rows[0];

      if (!subscription) {
        fail(404, "Suscripción no encontrada");
      }

      if (
        ![
          subscription.student_id,
          subscription.tutor_id,
        ].includes(req.user.id)
      ) {
        fail(403, "Sin permiso");
      }

      if (
        status === "approved" &&
        (
          subscription.tutor_id !== req.user.id ||
          subscription.status !== "pending"
        )
      ) {
        fail(
          409,
          "Solo el tutor puede aprobar solicitudes pendientes",
        );
      }

      if (subscription.status === "cancelled") {
        fail(409, "La suscripción ya está cancelada");
      }

      await client.query(
        "UPDATE subscriptions SET status=$2 WHERE id=$1",
        [id, status],
      );

      if (status === "cancelled") {
        await client.query(
          `DELETE FROM session_slots
           WHERE session_id IN(
             SELECT id
             FROM sessions
             WHERE subscription_id=$1
               AND status IN ('pending','approved')
           )`,
          [id],
        );

        await client.query(
          `UPDATE sessions
           SET status='cancelled'
           WHERE subscription_id=$1
             AND status IN ('pending','approved')`,
          [id],
        );
      } else {
        await client.query(
          `UPDATE sessions
           SET status='approved'
           WHERE subscription_id=$1
             AND status='pending'`,
          [id],
        );
      }

      await client.query(
        `INSERT INTO audit(actor_id,action,target)
         VALUES($1,$2,$3)`,
        [
          req.user.id,
          "subscription." + status,
          id,
        ],
      );
    });

    const email =
      status === "approved"
        ? await notifyEnrollment(id)
        : null;

    res.json({
      message: "Suscripción actualizada",
      email,
      warning: email?.error
        ? "La inscripción se aprobó, pero no se confirmó el correo."
        : null,
    });
  },
);

bookings.post(
  "/sessions/:id/complete",
  role("tutor"),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await tx(async (client) => {
      const result = await client.query(
        `UPDATE sessions
         SET status='completed'
         WHERE id=$1
           AND tutor_id=$2
           AND status='approved'
           AND end_at<=now()
         RETURNING id`,
        [id, req.user.id],
      );

      if (!result.rowCount) {
        fail(
          409,
          "La sesión debe estar aprobada, haber terminado y pertenecerte",
        );
      }

      await client.query(
        `INSERT INTO audit(actor_id,action,target)
         VALUES($1,$2,$3)`,
        [
          req.user.id,
          "session.completed",
          id,
        ],
      );
    });

    res.json({
      message: "Sesión marcada como impartida",
    });
  },
);

bookings.post(
  "/sessions/:id/reviews",
  role("student"),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);

    const body = z
      .object({
        stars: z.number().int().min(1).max(5),
        comment: z.string().trim().min(5).max(2000),
      })
      .parse(req.body);

    await tx(async (client) => {
      const session = (
        await client.query(
          `SELECT *
           FROM sessions
           WHERE id=$1
             AND student_id=$2
             AND status='completed'
             AND end_at<=now()
           FOR UPDATE`,
          [id, req.user.id],
        )
      ).rows[0];

      if (!session) {
        fail(
          403,
          "Solo puedes valorar sesiones tuyas impartidas",
        );
      }

      await client.query(
        `INSERT INTO reviews(
           session_id,tutor_id,student_id,stars,comment
         )
         VALUES($1,$2,$3,$4,$5)`,
        [
          id,
          session.tutor_id,
          req.user.id,
          body.stars,
          body.comment,
        ],
      );

      await client.query(
        `INSERT INTO audit(actor_id,action,target)
         VALUES($1,$2,$3)`,
        [
          req.user.id,
          "review.created",
          id,
        ],
      );
    });

    res.status(201).json({
      message: "Reseña registrada",
    });
  },
);