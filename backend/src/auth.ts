import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "./config.js";
import { query, tx } from "./db.js";
import { auth, fail, encrypt, safeUser } from "./core.js";
export const authRouter = Router();
const google = new OAuth2Client(env.GOOGLE_CLIENT_ID);
authRouter.post("/google", async (req, res) => {
  const { credential } = z
    .object({ credential: z.string().min(10) })
    .parse(req.body);
  if (req.headers.authorization !== "Bearer " + credential)
    fail(401, "Falta el token de identidad de Google");
  let p;
  try {
    p = (
      await google.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      })
    ).getPayload();
  } catch {
    fail(401, "Google no pudo verificar la identidad");
  }
  if (!p?.email_verified || !p.email)
    fail(401, "Correo de Google no verificado");
  const admin = env.ADMIN_EMAILS.split(",")
    .map((x) => x.trim().toLowerCase())
    .includes(p.email.toLowerCase());
  const u = (
    await query(
      `INSERT INTO users(google_sub,email,name,picture,role,onboarding,approved) VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT(google_sub) DO UPDATE SET name=EXCLUDED.name,picture=EXCLUDED.picture,updated_at=now() RETURNING *`,
      [
        p.sub,
        p.email.toLowerCase(),
        p.name || p.email,
        p.picture || "",
        admin ? "admin" : "student",
        admin,
      ],
    )
  ).rows[0];
  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: u.id,
    expiresIn: env.JWT_TTL_SECONDS,
    algorithm: "HS256",
    issuer: "tutoria-conecta",
    audience: "tutoria-web",
  });
  res.json({ token, user: safeUser(u) });
});
authRouter.use(auth);
authRouter.get("/me", (req, res) => res.json(safeUser(req.user)));
authRouter.post("/onboarding", async (req, res) => {
  if (req.user.suspended) fail(403, "ACCOUNT_SUSPENDED");
  if (req.user.onboarding) fail(409, "Perfil ya completado");
  const b = z
    .object({
      role: z.enum(["student", "tutor"]),
      phone: z.string().min(8).max(25),
      gender: z.string().min(1).max(50),
      address: z.string().min(8).max(300),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      document: z.string().min(6).max(40),
      affinities: z.array(z.string().uuid()).min(1),
      portfolio: z.string().url().startsWith("https://").optional(),
      bio: z.string().max(3000).optional(),
      hourly_rate: z.number().positive().max(100000).optional(),
    })
    .parse(req.body);
  if (
    b.role === "tutor" &&
    (!b.portfolio || !b.bio || b.bio.length < 20 || !b.hourly_rate)
  )
    fail(
      400,
      "Tutor: agrega portafolio HTTPS, biografía (20 caracteres) y tarifa",
    );
  const count = (
    await query(
      "SELECT id FROM categories WHERE active AND id=ANY($1::uuid[])",
      [b.affinities],
    )
  ).rowCount;
  if (count !== new Set(b.affinities).size) fail(400, "Categorías inválidas");
  const u = (
    await query(
      `UPDATE users SET role=$2,phone=$3,gender=$4,address=$5,lat=$6,lng=$7,document_cipher=$8,affinities=$9,portfolio=$10,bio=$11,hourly_rate=$12,onboarding=true,approved=($2='student'),updated_at=now() WHERE id=$1 AND NOT onboarding RETURNING *`,
      [
        req.user.id,
        b.role,
        b.phone,
        b.gender,
        b.address,
        b.lat,
        b.lng,
        encrypt(b.document),
        JSON.stringify(b.affinities),
        b.portfolio || null,
        b.bio || "",
        b.hourly_rate || null,
      ],
    )
  ).rows[0];
  if (!u) fail(409, "Perfil ya guardado");
  res.json(safeUser(u));
});
authRouter.get("/appeals", async (req, res) =>
  res.json(
    (
      await query(
        "SELECT * FROM appeals WHERE user_id=$1 ORDER BY created_at DESC",
        [req.user.id],
      )
    ).rows,
  ),
);
authRouter.post("/appeals", async (req, res) => {
  const b = z
    .object({ body: z.string().trim().min(20).max(4000) })
    .parse(req.body);
  await tx(async (c) => {
    const u = (
      await c.query("SELECT suspended FROM users WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ])
    ).rows[0];
    if (!u.suspended) fail(400, "Tu cuenta no está suspendida");
    await c.query("INSERT INTO appeals(user_id,body) VALUES($1,$2)", [
      req.user.id,
      b.body,
    ]);
  });
  res.status(201).json({ message: "Apelación enviada" });
});
