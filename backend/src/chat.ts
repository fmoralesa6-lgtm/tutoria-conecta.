import { Router } from "express";
import express from "express";
import { Server } from "socket.io";
import { z } from "zod";
import { query, tx } from "./db.js";
import { fail, tokenUser } from "./core.js";
export const chat = Router();

const attachmentSelect = `
  SELECT m.*,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id',a.id,
        'file_name',a.file_name,
        'mime_type',a.mime_type,
        'size_bytes',a.size_bytes
      ) ORDER BY a.created_at,a.id)
      FROM chat_attachments a
      WHERE a.message_id=m.id
    ),'[]'::json) AS attachments
  FROM messages m`;

function fileName(header: string | undefined) {
  let value = header || "archivo";
  try {
    value = decodeURIComponent(value);
  } catch {
    fail(400, "Nombre de archivo inválido");
  }
  value = value.split(/[\\/]/).pop() || "archivo";
  value = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!value || value.length > 255) fail(400, "Nombre de archivo inválido");
  return value;
}

function validMime(data: Buffer, declared: string) {
  if (
    declared === "application/pdf" &&
    data.subarray(0, 5).toString("ascii") === "%PDF-"
  ) return true;
  if (
    declared === "image/png" &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) return true;
  if (
    declared === "image/jpeg" &&
    data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  ) return true;
  return (
    declared === "image/webp" &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  );
}
export async function member(id: string, uid: string) {
  const c = (
    await query(
      `SELECT c.* FROM conversations c JOIN users s ON s.id=c.student_id JOIN users t ON t.id=c.tutor_id WHERE c.id=$1 AND ($2=c.student_id OR $2=c.tutor_id) AND NOT s.suspended AND NOT t.suspended`,
      [id, uid],
    )
  ).rows[0];
  if (!c) fail(403, "Conversación no disponible");
  return c;
}
chat.get("/conversations", async (req, res) =>
  res.json(
    (
      await query(
        "SELECT c.*,s.name student_name,t.name tutor_name FROM conversations c JOIN users s ON s.id=c.student_id JOIN users t ON t.id=c.tutor_id WHERE c.student_id=$1 OR c.tutor_id=$1",
        [req.user.id],
      )
    ).rows,
  ),
);
chat.post("/conversations", async (req, res) => {
  const id = z.string().uuid().parse(req.body.tutor_id);
  if (req.user.role !== "student")
    fail(403, "Solo estudiantes inician conversaciones");
  if (
    !(
      await query(
        "SELECT id FROM users WHERE id=$1 AND role='tutor' AND approved AND NOT suspended",
        [id],
      )
    ).rowCount
  )
    fail(404, "Tutor no disponible");
  res.json(
    (
      await query(
        "INSERT INTO conversations(student_id,tutor_id) VALUES($1,$2) ON CONFLICT(student_id,tutor_id) DO UPDATE SET student_id=EXCLUDED.student_id RETURNING *",
        [req.user.id, id],
      )
    ).rows[0],
  );
});
chat.get("/conversations/:id/messages", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  await member(id, req.user.id);
  res.json(
    (
      await query(
        `${attachmentSelect} WHERE m.conversation_id=$1 ORDER BY m.created_at,m.id`,
        [id],
      )
    ).rows,
  );
});

chat.post(
  "/conversations/:id/attachments",
  express.raw({ type: "application/octet-stream", limit: "5mb" }),
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await member(id, req.user.id);
    await query(
      "DELETE FROM chat_attachments WHERE message_id IS NULL AND created_at < now() - interval '1 day'",
    );
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      fail(400, "Selecciona un archivo válido");
    }
    if (req.body.length > 5 * 1024 * 1024) {
      fail(413, "Cada archivo debe pesar como máximo 5 MB");
    }
    const mime = String(req.get("x-file-type") || "").toLowerCase();
    if (!validMime(req.body, mime)) {
      fail(415, "Adjunta únicamente un PDF o una imagen JPG, PNG o WEBP válida");
    }
    const name = fileName(req.get("x-file-name"));
    const result = await query(
      `INSERT INTO chat_attachments(
         conversation_id,uploader_id,file_name,mime_type,size_bytes,data
       ) VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,file_name,mime_type,size_bytes`,
      [id, req.user.id, name, mime, req.body.length, req.body],
    );
    res.status(201).json(result.rows[0]);
  },
);

chat.get(
  "/conversations/:id/attachments/:attachmentId",
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const attachmentId = z.string().uuid().parse(req.params.attachmentId);
    await member(id, req.user.id);
    const attachment = (
      await query(
        `SELECT file_name,mime_type,size_bytes,data
         FROM chat_attachments
         WHERE id=$1 AND conversation_id=$2`,
        [attachmentId, id],
      )
    ).rows[0];
    if (!attachment) fail(404, "Archivo no encontrado");
    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("Content-Length", attachment.size_bytes);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(attachment.data);
  },
);

chat.delete(
  "/conversations/:id/attachments/:attachmentId",
  async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const attachmentId = z.string().uuid().parse(req.params.attachmentId);
    await member(id, req.user.id);
    const result = await query(
      `DELETE FROM chat_attachments
       WHERE id=$1 AND conversation_id=$2
         AND uploader_id=$3 AND message_id IS NULL
       RETURNING id`,
      [attachmentId, id, req.user.id],
    );
    if (!result.rowCount) fail(404, "Archivo temporal no encontrado");
    res.status(204).end();
  },
);
export function sockets(io: Server) {
  io.use(async (socket, next) => {
    try {
      const u = await tokenUser(String(socket.handshake.auth.token || ""));
      if (u.suspended || !u.onboarding) fail(403, "Cuenta restringida");
      socket.data.uid = u.id;
      next();
    } catch {
      next(new Error("Sesión inválida o cuenta restringida"));
    }
  });
  io.on("connection", (socket) => {
    socket.join("user:" + socket.data.uid);
    let count = 0,
      windowStart = Date.now();
    const run = (event: string, fn: (data: unknown) => Promise<unknown>) =>
      socket.on(event, async (data, ack) => {
        try {
          if (Date.now() - windowStart > 60000) {
            count = 0;
            windowStart = Date.now();
          }
          if (++count > 120) fail(429, "Demasiados mensajes");
          const u = await tokenUser(String(socket.handshake.auth.token));
          if (u.suspended || !u.onboarding) fail(403, "Cuenta restringida");
          const result = await fn(data);
          if (typeof ack === "function") ack({ ok: true, data: result });
        } catch (e) {
          const err = e as Error & { status?: number };
          if (typeof ack === "function")
            ack({ ok: false, message: err.message });
          if (err.status === 401 || err.status === 403) {
            socket.emit("account:changed");
            socket.disconnect(true);
          }
        }
      });
    run("chat:send", async (data) => {
      const b = z
        .object({
          conversation_id: z.string().uuid(),
          body: z.string().trim().max(2000).default(""),
          attachment_ids: z.array(z.string().uuid()).max(5).default([]),
        })
        .refine((value) => value.body.length > 0 || value.attachment_ids.length > 0, {
          message: "Escribe un mensaje o adjunta un archivo",
        })
        .refine((value) => new Set(value.attachment_ids).size === value.attachment_ids.length, {
          path: ["attachment_ids"],
          message: "No repitas archivos adjuntos",
        })
        .parse(data);
      const c = await member(b.conversation_id, socket.data.uid);
      const messageId = await tx(async (db) => {
        const message = (
          await db.query(
            "INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING id",
            [c.id, socket.data.uid, b.body],
          )
        ).rows[0];
        if (b.attachment_ids.length) {
          const linked = await db.query(
            `UPDATE chat_attachments
             SET message_id=$1
             WHERE id=ANY($2::uuid[])
               AND conversation_id=$3
               AND uploader_id=$4
               AND message_id IS NULL
             RETURNING id`,
            [message.id, b.attachment_ids, c.id, socket.data.uid],
          );
          if (linked.rowCount !== b.attachment_ids.length) {
            fail(409, "Un archivo ya no está disponible. Vuelve a adjuntarlo.");
          }
        }
        return message.id as string;
      });
      const m = (
        await query(
          `${attachmentSelect} WHERE m.id=$1`,
          [messageId],
        )
      ).rows[0];
      io.to("user:" + c.student_id)
        .to("user:" + c.tutor_id)
        .emit("chat:message", m);
      return m;
    });
    run("chat:read", async (data) => {
      const id = z
        .string()
        .uuid()
        .parse((data as { conversation_id: string }).conversation_id);
      const c = await member(id, socket.data.uid);
      const rows = await tx(
        async (db) =>
          (
            await db.query(
              "UPDATE messages SET read_at=now() WHERE conversation_id=$1 AND sender_id<>$2 AND read_at IS NULL RETURNING id,read_at",
              [id, socket.data.uid],
            )
          ).rows,
      );
      if (rows.length)
        io.to("user:" + c.student_id)
          .to("user:" + c.tutor_id)
          .emit("chat:read", { conversation_id: id, rows });
      return rows;
    });
    const timer = setInterval(async () => {
      try {
        const u = await tokenUser(String(socket.handshake.auth.token));
        if (u.suspended) throw Error();
      } catch {
        socket.emit("account:changed");
        socket.disconnect(true);
      }
    }, 30000);
    socket.on("disconnect", () => clearInterval(timer));
  });
}