import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { ZodError } from "zod";
import { env } from "./config.js";
import { pool } from "./db.js";
import { auth, active } from "./core.js";
import { authRouter } from "./auth.js";
import { catalog } from "./catalog.js";
import { bookings } from "./bookings.js";
import { admin, moderation } from "./admin.js";
import { chat, sockets } from "./chat.js";
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: "64kb" }));
app.use(rateLimit({ windowMs: 60000, limit: 240 }));
app.use("/api/auth/google", rateLimit({ windowMs: 900000, limit: 40 }));
app.use("/api/auth", authRouter);
app.use("/api", auth, catalog);
app.use("/api", active, bookings, moderation, chat);
app.use("/api/admin", admin);
app.use((_req, res) => res.status(404).json({ message: "Ruta no encontrada" }));
app.use(
  (
    err: Error & { status?: number; code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    let status = err.status || 500,
      message = err.message;
    if (err instanceof ZodError) {
      status = 400;
      message = err.issues
        .map((i) => i.path.join(".") + ": " + i.message)
        .join("; ");
    }
    if (err.code === "23P01") {
      status = 409;
      message =
        "Hay un traslape para el tutor o el estudiante. No se guardó ninguna sesión del bloque.";
    }
    if (err.code === "23505") {
      status = 409;
      message = "Ya existe este registro o solicitud";
    }
    if (err.code === "23503") {
      status = 409;
      message =
        "El registro está relacionado con otros datos. Desactívalo o revisa su identificador.";
    }
    if (status === 500) {
      console.error(err);
      message = "No se pudo completar la operación";
    }
    res.status(status).json({ message });
  },
);
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: env.CLIENT_ORIGIN },
  maxHttpBufferSize: 10000,
});
app.set("io", io);
sockets(io);
await pool.query("SELECT 1");
server.listen(env.PORT, "0.0.0.0", () =>
  console.log("API en puerto " + env.PORT),
);
process.on("SIGTERM", () => {
  io.close();
  server.close(() => {
    void pool.end();
  });
});
