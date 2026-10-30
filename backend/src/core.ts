import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { query } from "./db.js";
import { env } from "./config.js";

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: "student" | "tutor" | "admin";
  onboarding: boolean;
  approved: boolean;
  suspended: boolean;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user: User;
    }
  }
}

export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(env.DOCUMENT_KEY, "hex"),
    iv,
  );

  const enc = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return [iv, cipher.getAuthTag(), enc]
    .map((x) => x.toString("hex"))
    .join(":");
}

export function decrypt(value: string) {
  const [iv, tag, data] = value
    .split(":")
    .map((x) => Buffer.from(x, "hex"));

  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(env.DOCUMENT_KEY, "hex"),
    iv,
  );

  cipher.setAuthTag(tag);

  return Buffer.concat([
    cipher.update(data),
    cipher.final(),
  ]).toString("utf8");
}

export function safeUser(user: User) {
  const { document_cipher, google_sub, ...safe } = user;

  return {
    ...safe,
    has_document: !!document_cipher,
  };
}

export async function tokenUser(token: string): Promise<User> {
  let sub: string;

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "tutoria-conecta",
      audience: "tutoria-web",
    });

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !payload.sub
    ) {
      fail(401, "Sesión inválida");
    }

    sub = payload.sub;
  } catch {
    fail(401, "Sesión vencida o inválida");
  }

  const user = (
    await query("SELECT * FROM users WHERE id=$1", [sub])
  ).rows[0];

  if (!user) {
    fail(401, "Sesión inválida");
  }

  return user;
}

export async function auth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization;

  const match =
    typeof authorization === "string"
      ? /^Bearer ([^\s]+)$/i.exec(authorization)
      : null;

  if (!match) {
    fail(401, "Se requiere Authorization: Bearer TOKEN");
  }

  req.user = await tokenUser(match[1]);

  next();
}

export function active(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (req.user.suspended) {
    fail(403, "ACCOUNT_SUSPENDED");
  }

  if (!req.user.onboarding) {
    fail(403, "ONBOARDING_REQUIRED");
  }

  next();
}

export const role =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      fail(403, "No tienes permiso");
    }

    next();
  };

export async function audit(
  actor: string,
  action: string,
  target: string,
  detail: unknown = {},
) {
  await query(
    "INSERT INTO audit(actor_id,action,target,detail) VALUES($1,$2,$3,$4)",
    [actor, action, target, JSON.stringify(detail)],
  );
}