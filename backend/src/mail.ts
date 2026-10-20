import { z } from "zod";
import { env } from "./config.js";

const mailSchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1),
});

type MailInput = z.infer<typeof mailSchema>;

export async function sendMail(input: MailInput) {
  const mail = mailSchema.parse(input);

  if (!env.BREVO_API_KEY || !env.MAIL_FROM_EMAIL) {
    throw new Error(
      "Configura BREVO_API_KEY y MAIL_FROM_EMAIL en backend/.env.",
    );
  }

  let response: Response;

  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: env.MAIL_FROM_NAME,
          email: env.MAIL_FROM_EMAIL,
        },
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "No se pudo confirmar el envío. Revisa tu conexión y los registros de Brevo antes de repetir la prueba.",
    );
  }

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = z
      .object({
        message: z.string().optional(),
      })
      .safeParse(result);

    const detail = error.success
      ? error.data.message
      : undefined;

    throw new Error(
      `Brevo respondió HTTP ${response.status}: ${
        detail || "No se pudo enviar el correo."
      }`,
    );
  }

  const accepted = z
    .object({
      messageId: z.string().optional(),
    })
    .safeParse(result);

  return {
    messageId: accepted.success
      ? accepted.data.messageId
      : undefined,
  };
}