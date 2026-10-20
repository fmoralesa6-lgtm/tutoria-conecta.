import "dotenv/config";
import { z } from "zod";

export const env = z
  .object({
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(10),
    JWT_SECRET: z.string().min(32),
    JWT_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86400)
      .default(7200),
    GOOGLE_CLIENT_ID: z.string().min(10),
    CLIENT_ORIGIN: z.string().url(),
    ADMIN_EMAILS: z.string().min(3),
    ORS_API_KEY: z.string().min(10),
    DOCUMENT_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
    BREVO_API_KEY: z.string().trim().default(""),
    MAIL_FROM_EMAIL: z
      .union([z.literal(""), z.string().email()])
      .default(""),
    MAIL_FROM_NAME: z
      .string()
      .trim()
      .min(1)
      .default("Tutoría Conecta"),
  })
  .parse(process.env);