import { query } from "./db.js";
import { sendMail } from "./mail.js";

type Delivery = {
  email: string;
  subject: string;
  text: string;
};

type MailResult = {
  accepted: number;
  failed: number;
  error: boolean;
};

async function deliver(items: Delivery[]): Promise<MailResult> {
  const unique = new Map<string, Delivery>();

  for (const item of items) {
    const email = item.email.trim().toLowerCase();

    if (!unique.has(email)) {
      unique.set(email, { ...item, email });
    }
  }

  const queue = [...unique.values()];
  const result: MailResult = {
    accepted: 0,
    failed: 0,
    error: false,
  };

  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const item = queue[index++];

      try {
        await sendMail({
          to: item.email,
          subject: item.subject,
          text: item.text,
        });

        result.accepted++;
      } catch {
        result.failed++;
        result.error = true;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(4, queue.length) },
      () => worker(),
    ),
  );

  if (result.failed > 0) {
    console.error(
      `[correo] No se confirmó el envío de ${result.failed} mensajes. Revisa los registros de Brevo.`,
    );
  }

  return result;
}

export async function notifyMeeting(
  postId: string,
): Promise<MailResult> {
  try {
    const post = (
      await query(
        `SELECT
           p.id,
           p.title,
           p.body,
           p.url,
           o.id AS offer_id,
           o.title AS course_title,
           t.name AS tutor_name
         FROM course_posts p
         JOIN offers o ON o.id=p.offer_id
         JOIN users t ON t.id=o.tutor_id
         WHERE p.id=$1
           AND p.kind='meeting'
           AND t.approved
           AND NOT t.suspended`,
        [postId],
      )
    ).rows[0];

    if (!post) {
      return { accepted: 0, failed: 0, error: false };
    }

    const recipients = (
      await query(
        `SELECT DISTINCT u.email
         FROM subscriptions sub
         JOIN users u ON u.id=sub.student_id
         WHERE sub.offer_id=$1
           AND sub.status='approved'
           AND sub.modality='virtual'
           AND u.role='student'
           AND NOT u.suspended`,
        [post.offer_id],
      )
    ).rows;
    console.log(
  "[correo] Curso:",
  post.course_title,
  "| Estudiantes virtuales aprobados:",
  recipients.length,
);

    return await deliver(
      recipients.map((student) => ({
        email: student.email,
        subject: `Clase virtual: ${post.course_title}`.slice(0, 200),
        text: [
          "Hola:",
          "",
          "Se ha publicado o actualizado el enlace de una clase virtual.",
          "",
          `Curso: ${post.course_title}`,
          `Tutor: ${post.tutor_name}`,
          `Publicación: ${post.title}`,
          "",
          post.body,
          "",
          `Enlace de la clase: ${post.url}`,
          "",
          "Consulta tu agenda para confirmar las fechas y los horarios.",
          "También puedes encontrar esta publicación en el tablero del curso.",
          "",
          "Tutoría Conecta",
        ].join("\n"),
      })),
    );
  } catch {
    console.error(
      `[correo] No se pudieron preparar los avisos de la publicación ${postId}.`,
    );

    return { accepted: 0, failed: 0, error: true };
  }
}

export async function notifyEnrollment(
  subscriptionId: string,
): Promise<MailResult> {
  try {
    const subscription = (
      await query(
        `SELECT
           sub.id,
           sub.offer_id,
           u.name AS student_name,
           u.email,
           o.title AS course_title,
           t.name AS tutor_name
         FROM subscriptions sub
         JOIN users u ON u.id=sub.student_id
         JOIN offers o ON o.id=sub.offer_id
         JOIN users t ON t.id=o.tutor_id
         WHERE sub.id=$1
           AND sub.status='approved'
           AND sub.modality='virtual'
           AND u.role='student'
           AND NOT u.suspended
           AND t.approved
           AND NOT t.suspended`,
        [subscriptionId],
      )
    ).rows[0];

    if (!subscription) {
      return { accepted: 0, failed: 0, error: false };
    }

    const posts = (
      await query(
        `SELECT title,body,url
         FROM course_posts
         WHERE offer_id=$1
           AND kind='meeting'
         ORDER BY created_at DESC,id`,
        [subscription.offer_id],
      )
    ).rows;

    if (posts.length === 0) {
      return { accepted: 0, failed: 0, error: false };
    }

    const meetings = posts
      .map((post, index) =>
        [
          `${index + 1}. ${post.title}`,
          post.body,
          `Enlace: ${post.url}`,
        ].join("\n"),
      )
      .join("\n\n");

    return await deliver([
      {
        email: subscription.email,
        subject:
          `Inscripción aprobada: ${subscription.course_title}`.slice(
            0,
            200,
          ),
        text: [
          `Hola, ${subscription.student_name}:`,
          "",
          "Tu inscripción ha sido aprobada.",
          "",
          `Curso: ${subscription.course_title}`,
          `Tutor: ${subscription.tutor_name}`,
          "",
          "Estas son las publicaciones de clases virtuales disponibles en el tablero:",
          "",
          meetings,
          "",
          "Consulta tu agenda para confirmar tus fechas y horarios.",
          "",
          "Tutoría Conecta",
        ].join("\n"),
      },
    ]);
  } catch {
    console.error(
      `[correo] No se pudieron preparar los enlaces de la inscripción ${subscriptionId}.`,
    );

    return { accepted: 0, failed: 0, error: true };
  }
}