import { env } from "./config.js";
import { sendMail } from "./mail.js";

async function main() {
  const result = await sendMail({
    to: env.MAIL_FROM_EMAIL,
    subject: "Prueba de correo — Tutoría Conecta",
    text: [
      "Hola, Fredy:",
      "",
      "Este es un correo de prueba enviado desde el backend de Tutoría Conecta.",
      "",
      "Si estás leyendo este mensaje, el envío mediante Brevo está funcionando.",
      "",
      "Tutoría Conecta",
    ].join("\n"),
  });

  console.log("Brevo aceptó el correo para su envío.");
  console.log("Revisa tu bandeja de entrada y la carpeta de spam.");

  if (result.messageId) {
    console.log("Identificador:", result.messageId);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "No se pudo completar la prueba.",
  );

  process.exitCode = 1;
});