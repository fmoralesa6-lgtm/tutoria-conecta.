import { Router } from "express";
import { Server } from "socket.io";
import { z } from "zod";
import { query, tx } from "./db.js";
import { fail, tokenUser } from "./core.js";
export const chat = Router();
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
        "SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at,id",
        [id],
      )
    ).rows,
  );
});
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
          body: z.string().trim().min(1).max(2000),
        })
        .parse(data);
      const c = await member(b.conversation_id, socket.data.uid);
      const m = (
        await query(
          "INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING *",
          [c.id, socket.data.uid, b.body],
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
