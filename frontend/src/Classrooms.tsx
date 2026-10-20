import { useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import {
  Field,
  Notice,
  Status,
  date,
  useAction,
  useData,
} from "./ui";

type Course = {
  id: string;
  title: string;
  tutor_name: string;
  modalities: string[];
};

type Kind = "announcement" | "material" | "meeting";

type Post = {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  url: string;
  created_at: string;
  updated_at: string;
};

type PostBody = {
  kind: Kind;
  title: string;
  body: string;
  url: string;
};

type MailResult = {
  accepted: number;
  failed: number;
  error: boolean;
};

type SaveResponse = Post & {
  email?: MailResult | null;
  warning?: string | null;
};

type Feedback = {
  warning: boolean;
  message: string;
};

const kinds: Record<Kind, string> = {
  announcement: "Anuncio",
  material: "Material de estudio",
  meeting: "Clase virtual",
};

function mailFeedback(result: SaveResponse): Feedback {
  const email = result.email;

  if (result.warning || email?.error || (email?.failed ?? 0) > 0) {
    return {
      warning: true,
      message: [
        "La publicación se guardó.",
        email
          ? `Correos aceptados por Brevo: ${email.accepted}. Envíos no confirmados: ${email.failed}.`
          : "",
        result.warning ||
          "No se pudo completar la notificación por correo.",
        "El enlace sigue disponible en el tablero. Revisa los registros de Brevo antes de repetir el envío.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (email) {
    if (email.accepted > 0) {
      return {
        warning: false,
        message:
          `Brevo aceptó ${email.accepted} correo(s) para su envío. ` +
          "Los estudiantes pueden revisar su bandeja de entrada y la carpeta de spam. La recepción todavía depende del servicio de correo.",
      };
    }

    return {
      warning: false,
      message:
        "La publicación se guardó, pero no se enviaron correos. " +
        "Verifica que este curso tenga estudiantes con inscripción virtual aprobada y cuentas habilitadas.",
    };
  }

  if (result.kind !== "meeting") {
    return {
      warning: false,
      message:
        "Disponible en el tablero. Los anuncios y materiales no generan avisos por correo.",
    };
  }

  if (email === null) {
    return {
      warning: false,
      message:
        "Los cambios se guardaron sin enviar otro correo. " +
        "Al editar una clase virtual, el aviso se activa únicamente cuando cambia el enlace o la publicación pasa a ser de tipo Clase virtual.",
    };
  }

  return {
    warning: true,
    message:
      "La publicación se guardó, pero el servidor no informó el resultado del correo. No repitas el envío sin revisar los registros.",
  };
}

export default function Classrooms() {
  const { state } = useAuth();

  if (
    !state.user ||
    !["tutor", "student"].includes(state.user.role)
  ) {
    return null;
  }

  return <CourseList tutor={state.user.role === "tutor"} />;
}

function CourseList({ tutor }: { tutor: boolean }) {
  const q = useData<Course[]>("/classrooms");
  const [selected, setSelected] = useState("");

  const course = q.data?.find((item) => item.id === selected);

  return (
    <section className="panel">
      <div className="card-bottom">
        <h2>
          {tutor
            ? "Tablero de mis tutorías"
            : "Mis cursos: anuncios, materiales y clases"}
        </h2>

        <button
          type="button"
          className="secondary"
          disabled={q.loading}
          onClick={() => void q.reload()}
        >
          Actualizar cursos
        </button>
      </div>

      <p>
        {tutor
          ? "Selecciona una tutoría. Sus estudiantes con inscripción aprobada podrán consultar lo que publiques."
          : "Aquí aparecen las tutorías en las que tienes una inscripción aprobada."}
      </p>

      <Status {...q} />

      {!q.loading && !q.error && (
        <>
          {q.data?.length === 0 ? (
            <p>
              {tutor
                ? "Necesitas un perfil aprobado y una tutoría publicada."
                : "Todavía no tienes inscripciones aprobadas."}
            </p>
          ) : (
            <Field label="Tutoría">
              <select
                value={course?.id || ""}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">Selecciona una tutoría</option>

                {q.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.tutor_name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {course && (
            <Board
              key={course.id}
              course={course}
              tutor={tutor}
            />
          )}
        </>
      )}
    </section>
  );
}

function Board({
  course,
  tutor,
}: {
  course: Course;
  tutor: boolean;
}) {
  const path = "/classrooms/" + course.id + "/posts";
  const q = useData<Post[]>(path);
  const a = useAction();

  const [editing, setEditing] = useState<Post | null>(null);
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState("all");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const visible = q.data?.filter(
    (post) => filter === "all" || post.kind === filter,
  );

  function save(body: PostBody) {
    const previous = editing;

    setFeedback(null);

    void a.run(
      async () => {
        const result = await api<SaveResponse>(
          path + (previous ? "/" + previous.id : ""),
          previous ? "PUT" : "POST",
          body,
        );

        setFeedback(mailFeedback(result));
        setEditing(null);
        setVersion((value) => value + 1);

        await q.reload();
      },
      previous
        ? "Publicación actualizada"
        : "Publicación creada",
    );
  }

  return (
    <div>
      <h3>{course.title}</h3>

      <Notice {...a} />

      {feedback && (
        <div
          className={feedback.warning ? "alert error" : "alert"}
          role={feedback.warning ? "alert" : "status"}
        >
          <strong>
            {feedback.warning
              ? "Aviso sobre el correo"
              : "Resultado de la publicación"}
          </strong>
          <p>{feedback.message}</p>
        </div>
      )}

      {tutor && (
        <PostForm
          key={(editing?.id || "new") + version}
          post={editing}
          virtual={course.modalities.includes("virtual")}
          busy={a.busy}
          cancel={() => {
            setEditing(null);
            setFeedback(null);
            setVersion((value) => value + 1);
          }}
          save={save}
        />
      )}

      <div className="row">
        <Field label="Mostrar">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Todo</option>

            {Object.entries(kinds).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <button
          type="button"
          className="secondary"
          disabled={q.loading || a.busy}
          onClick={() => void q.reload()}
        >
          Actualizar publicaciones
        </button>
      </div>

      <Status {...q} />

      {!q.loading && !q.error && (
        <>
          {visible?.length === 0 && (
            <p>No hay publicaciones en esta sección.</p>
          )}

          {visible?.map((post) => (
            <article className="panel" key={post.id}>
              <span className="pill">{kinds[post.kind]}</span>

              <h3>{post.title}</h3>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {post.body}
              </p>

              {post.url && /^https:\/\//i.test(post.url) && (
                <p>
                  <a
                    className="button"
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {post.kind === "meeting"
                      ? "Entrar a la clase virtual"
                      : post.kind === "material"
                        ? "Abrir material"
                        : "Abrir enlace"}
                  </a>
                </p>
              )}

              {post.kind === "meeting" && (
                <p>
                  <small>
                    Consulta tu agenda para confirmar la fecha
                    y el horario que te corresponden.
                  </small>
                </p>
              )}

              <p>
                <small>
                  Publicado: {date(post.created_at)}
                  {post.updated_at !== post.created_at && (
                    <> · Editado: {date(post.updated_at)}</>
                  )}
                </small>
              </p>

              {tutor && (
                <div className="row">
                  <button
                    type="button"
                    className="secondary"
                    disabled={a.busy}
                    onClick={() => {
                      setEditing(post);
                      setFeedback(null);
                      setVersion((value) => value + 1);
                    }}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    className="danger"
                    disabled={a.busy}
                    onClick={() => {
                      if (!confirm("¿Eliminar esta publicación?")) {
                        return;
                      }

                      setFeedback(null);

                      void a.run(async () => {
                        await api(path + "/" + post.id, "DELETE");

                        if (editing?.id === post.id) {
                          setEditing(null);
                          setVersion((value) => value + 1);
                        }

                        await q.reload();
                      }, "Publicación eliminada");
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </article>
          ))}
        </>
      )}
    </div>
  );
}

function PostForm({
  post,
  virtual,
  busy,
  cancel,
  save,
}: {
  post: Post | null;
  virtual: boolean;
  busy: boolean;
  cancel: () => void;
  save: (body: PostBody) => void;
}) {
  const [kind, setKind] = useState<Kind>(
    post?.kind || "announcement",
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (busy) return;

        const form = new FormData(event.currentTarget);

        save({
          kind,
          title: String(form.get("title") || "").trim(),
          body: String(form.get("body") || "").trim(),
          url: String(form.get("url") || "").trim(),
        });
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          {post ? "Editar publicación" : "Nueva publicación"}
        </legend>

        <Field label="Tipo">
          <select
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as Kind)
            }
          >
            <option value="announcement">Anuncio</option>
            <option value="material">Material de estudio</option>

            {(virtual || post?.kind === "meeting") && (
              <option value="meeting">Clase virtual</option>
            )}
          </select>
        </Field>

        <Field label="Título">
          <input
            name="title"
            required
            minLength={3}
            maxLength={160}
            defaultValue={post?.title || ""}
          />
        </Field>

        <Field label="Contenido o instrucciones">
          <textarea
            name="body"
            required
            minLength={3}
            maxLength={6000}
            defaultValue={post?.body || ""}
          />
        </Field>

        <Field
          label={
            kind === "announcement"
              ? "Enlace HTTPS (opcional)"
              : "Enlace HTTPS (obligatorio)"
          }
        >
          <input
            name="url"
            type="url"
            required={kind !== "announcement"}
            maxLength={2000}
            pattern="https://.*"
            placeholder="https://..."
            defaultValue={post?.url || ""}
          />
        </Field>

        {kind === "announcement" && (
          <p>
            El anuncio estará disponible en el tablero.
            Este tipo de publicación no envía correos.
          </p>
        )}

        {kind === "material" && (
          <p>
            Pega el enlace de tu PDF, documento, presentación
            o video con permisos de lectura para tus estudiantes.
            El material estará disponible en el tablero y no
            enviará correos.
          </p>
        )}

        {kind === "meeting" && (
          <div className="alert">
            <strong>Enlace de la clase y aviso por correo</strong>

            <p>
              Pega el enlace de Meet, Zoom o Teams e indica en
              el contenido a qué sesión corresponde.
            </p>

            <p>
              Al publicar, se intentará enviar el enlace a los
              estudiantes con inscripción virtual aprobada y
              cuentas habilitadas.
            </p>

            <p>
              Al editar, se enviará otro aviso únicamente si
              cambias el enlace o conviertes una publicación
              de otro tipo en Clase virtual.
            </p>

            <p>
              El enlace también quedará disponible en el
              tablero del curso.
            </p>
          </div>
        )}

        <button type="submit" disabled={busy}>
          {busy
            ? "Guardando, espera…"
            : post
              ? "Guardar cambios"
              : "Publicar"}
        </button>

        {post && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={cancel}
          >
            Cancelar edición
          </button>
        )}
      </fieldset>
    </form>
  );
}