import { Router } from "express";
import { z } from "zod";
import { query } from "./db.js";
import { fail, role } from "./core.js";
import { fits, recurring, type Block } from "./rules.js";

export const availableTimes = Router();

const schema = z.object({
  offer_id: z.string().uuid(),
  weeks: z.union([z.literal(4), z.literal(8)]),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
      const d = new Date(v + "T00:00:00Z");
      return (
        Number.isFinite(d.getTime()) &&
        d.toISOString().slice(0, 10) === v
      );
    }, "Fecha inválida"),
  days: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .transform((v) => [...new Set(v)]),
  duration: z.number().int().min(30).max(480),
});

availableTimes.post(
  "/available-times",
  role("student"),
  async (req, res) => {
    const b = schema.parse(req.body);

    const o = (
      await query(
        `SELECT o.tutor_id
         FROM offers o
         JOIN users u ON u.id=o.tutor_id
         JOIN categories c ON c.id=o.category_id
         LEFT JOIN categories p ON p.id=c.parent_id
         WHERE o.id=$1
           AND o.active
           AND u.approved
           AND NOT u.suspended
           AND c.active
           AND (p.id IS NULL OR p.active)`,
        [b.offer_id],
      )
    ).rows[0];

    if (!o) fail(404, "Oferta no disponible");
    if (o.tutor_id === req.user.id) {
      fail(400, "No puedes contratarte");
    }

    const start = new Date(b.start_date + "T00:00:00-06:00");
    const now = Date.now();

    if (
      start.getTime() > now + 366 * 86400000 ||
      start.getTime() + 86400000 <= now
    ) {
      fail(400, "Selecciona una fecha desde hoy y dentro de un año");
    }

    const end = new Date(
      start.getTime() + b.weeks * 7 * 86400000,
    );

    const blocks: Block[] = (
      await query(
        `SELECT weekday,start_min,end_min
         FROM availability
         WHERE tutor_id=$1`,
        [o.tutor_id],
      )
    ).rows;

    const occupied = (
      await query(
        `SELECT lower(period) AS start_at,
                upper(period) AS end_at
         FROM session_slots
         WHERE user_id=ANY($1::uuid[])
           AND period && tstzrange(
             $2::timestamptz,
             $3::timestamptz,
             '[)'
           )`,
        [
          [o.tutor_id, req.user.id],
          start.toISOString(),
          end.toISOString(),
        ],
      )
    ).rows.map((r) => ({
      start: new Date(r.start_at).getTime(),
      end: new Date(r.end_at).getTime(),
    }));

    const candidates = new Set<number>();

    for (const block of blocks) {
      if (!b.days.includes(block.weekday)) continue;

      for (
        let minute = block.start_min;
        minute + b.duration <= block.end_min;
        minute += 30
      ) {
        candidates.add(minute);
      }
    }

    const options = [...candidates]
      .sort((a, c) => a - c)
      .filter((minute) =>
        b.days.every((day) =>
          fits(blocks, day, minute, b.duration),
        ),
      )
      .map((minute) => {
        const slots = recurring(
          b.start_date,
          b.weeks,
          b.days,
          minute,
          b.duration,
        );

        let reason = "";

        for (const slot of slots) {
          const from = new Date(slot.start).getTime();
          const to = new Date(slot.end).getTime();

          const day = new Date(from - 21600000)
            .toISOString()
            .slice(0, 10);

          if (
            from <= now ||
            (slot === slots[0] &&
              from > now + 366 * 86400000)
          ) {
            reason =
              "La primera sesión debe ser futura y dentro de un año";
            break;
          }

          if (
            occupied.some(
              (r) => from < r.end && to > r.start,
            )
          ) {
            reason =
              `Horario ocupado el ${day} para el tutor o para ti`;
            break;
          }
        }

        return {
          minute,
          available: !reason,
          reason,
        };
      });

    res.json({ options });
  },
);