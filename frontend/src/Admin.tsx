import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import StudentEnrollments from "./StudentEnrollments";
import { api } from "./api";
import {
  Field,
  Notice,
  Status,
  useAction,
  useData,
  date,
  labels,
} from "./ui";
import type {
  User,
  Category,
  Report,
  Appeal,
  Audit,
  Metrics,
  Review,
} from "./types";

export default function Admin() {
  const [tab, setTab] = useState("users");

  return (
    <>
      <h1>Administración</h1>

      <nav className="tabs">
        {[
          ["users", "Tutores y cuentas"],
          ["categories", "Categorías"],
          ["reports", "Denuncias"],
          ["appeals", "Apelaciones"],
          ["analytics", "Reportería"],
          ["audit", "Auditoría"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "" : "secondary"}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "users" ? (
        <Users />
      ) : tab === "categories" ? (
        <Categories />
      ) : tab === "reports" ? (
        <Reports />
      ) : tab === "appeals" ? (
        <Appeals />
      ) : tab === "analytics" ? (
        <Analytics />
      ) : (
        <AuditLog />
      )}
    </>
  );
}

function Users() {
  const q = useData<User[]>("/admin/users");
  const a = useAction();

  const [document, setDocument] = useState("");
  const [history, setHistory] = useState("");
  const [studentId, setStudentId] = useState("");

  return (
    <>
      <Notice {...a} />
      <Status {...q} />

      {studentId && (
        <StudentEnrollments
          key={studentId}
          studentId={studentId}
          close={() => setStudentId("")}
        />
      )}

      {document && (
        <div className="alert">
          Documento: {document}{" "}
          <button onClick={() => setDocument("")}>
            Ocultar
          </button>
        </div>
      )}

      {history && (
        <section className="panel">
          <button onClick={() => setHistory("")}>
            Cerrar historial
          </button>
          <Reports user={history} />
        </section>
      )}

      <div className="grid cards">
        {q.data?.map((u) => (
          <article className="panel" key={u.id}>
            <h2>{u.name}</h2>
            <p>{u.email}</p>

            <p>
              {labels[u.role]} ·{" "}
              {u.suspended
                ? "Suspendido"
                : u.approved
                  ? "Aprobado"
                  : "Pendiente"}
            </p>

            {u.role === "student" && (
              <button
                className="secondary"
                onClick={() => setStudentId(u.id)}
              >
                Ver inscripciones y horarios
              </button>
            )}

            <p>{u.bio}</p>

            {u.portfolio && (
              <a
                href={u.portfolio}
                target="_blank"
                rel="noreferrer"
              >
                Revisar portafolio
              </a>
            )}

            <p>
              {u.phone} · {u.address}
            </p>

            {u.has_document && (
              <button
                className="secondary"
                disabled={a.busy}
                onClick={() =>
                  void a.run(async () => {
                    const result = await api<{
                      document: string;
                    }>(
                      "/admin/users/" + u.id + "/document",
                    );

                    setDocument(result.document);
                  }, "Consulta registrada en auditoría")
                }
              >
                Ver identificación
              </button>
            )}

            {u.role === "tutor" &&
              !u.approved &&
              u.onboarding && (
                <button
                  disabled={a.busy}
                  onClick={() =>
                    void a.run(async () => {
                      await api(
                        "/admin/users/" + u.id + "/approve",
                        "PATCH",
                        {},
                      );
                      await q.reload();
                    })
                  }
                >
                  Aprobar tutor
                </button>
              )}

            {u.role !== "admin" && !u.suspended && (
              <button
                className="danger"
                disabled={a.busy}
                onClick={() => {
                  const reason = prompt(
                    "Motivo de suspensión (mínimo 10 caracteres)",
                  );

                  if (reason) {
                    void a.run(async () => {
                      await api(
                        "/admin/users/" + u.id + "/suspend",
                        "POST",
                        { reason },
                      );
                      await q.reload();
                    });
                  }
                }}
              >
                Suspender
              </button>
            )}

            <button
              className="secondary"
              onClick={() => setHistory(u.id)}
            >
              Historial de denuncias
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function Categories() {
  const q = useData<Category[]>("/admin/categories");
  const a = useAction();
  const [editing, setEditing] =
    useState<Category | null>(null);

  return (
    <>
      <Notice {...a} />
      <Status {...q} />

      <form
        className="panel"
        key={editing?.id || "new"}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);

          void a.run(async () => {
            await api(
              "/admin/categories" +
                (editing ? "/" + editing.id : ""),
              editing ? "PUT" : "POST",
              {
                name: f.get("name"),
                parent_id: f.get("parent") || null,
                active: f.get("active") === "on",
              },
            );

            setEditing(null);
            await q.reload();
          });
        }}
      >
        <h2>
          {editing
            ? "Editar categoría"
            : "Nueva categoría o subcategoría"}
        </h2>

        <Field label="Nombre">
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={editing?.name}
          />
        </Field>

        <Field label="Categoría principal">
          <select
            name="parent"
            defaultValue={editing?.parent_id || ""}
          >
            <option value="">
              Ninguna (categoría principal)
            </option>

            {q.data
              ?.filter(
                (c) => !c.parent_id && c.id !== editing?.id,
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>

        <label className="check">
          <input
            name="active"
            type="checkbox"
            defaultChecked={editing?.active ?? true}
          />
          Activa
        </label>

        <button disabled={a.busy}>Guardar</button>

        <button
          type="button"
          className="secondary"
          onClick={() => setEditing(null)}
        >
          Nueva
        </button>
      </form>

      {q.data?.map((c) => (
        <article className="panel row" key={c.id}>
          <span>
            {c.parent_id
              ? q.data?.find((p) => p.id === c.parent_id)
                  ?.name + " / "
              : ""}
            {c.name} · {c.active ? "Activa" : "Inactiva"}
          </span>

          <button onClick={() => setEditing(c)}>
            Editar
          </button>

          <button
            className="danger"
            disabled={a.busy}
            onClick={() => {
              if (
                confirm(
                  "¿Eliminar categoría? Si tiene datos relacionados, desactívala.",
                )
              ) {
                void a.run(async () => {
                  await api(
                    "/admin/categories/" + c.id,
                    "DELETE",
                  );
                  await q.reload();
                });
              }
            }}
          >
            Eliminar
          </button>
        </article>
      ))}
    </>
  );
}

function Reports({ user = "" }: { user?: string }) {
  const q = useData<Report[]>(
    "/admin/reports" + (user ? "?user=" + user : ""),
  );
  const a = useAction();
  const [onlyOpen, setOnlyOpen] = useState(false);

  return (
    <>
      <h2>Denuncias e historial</h2>

      <label className="check">
        <input
          type="checkbox"
          checked={onlyOpen}
          onChange={(e) => setOnlyOpen(e.target.checked)}
        />
        Solo activas
      </label>

      <Notice {...a} />
      <Status {...q} />

      {q.data
        ?.filter((r) => !onlyOpen || r.status === "open")
        .map((r) => (
          <article className="panel" key={r.id}>
            <h3>
              {r.reason} · {labels[r.status]}
            </h3>

            <p>
              {r.reporter_name} reporta a {r.target_name}
            </p>

            <p>{r.evidence}</p>
            <small>{date(r.created_at)}</small>
            <p>{r.resolution}</p>

            {r.status === "open" && (
              <button
                disabled={a.busy}
                onClick={() => {
                  const resolution = prompt(
                    "Resolución (mínimo 10 caracteres)",
                  );

                  if (resolution) {
                    void a.run(async () => {
                      await api(
                        "/admin/reports/" + r.id,
                        "PATCH",
                        { resolution },
                      );
                      await q.reload();
                    });
                  }
                }}
              >
                Resolver denuncia
              </button>
            )}
          </article>
        ))}
    </>
  );
}

function Appeals() {
  const q = useData<Appeal[]>("/admin/appeals");
  const a = useAction();

  return (
    <>
      <Notice {...a} />
      <Status {...q} />

      {q.data?.map((r) => (
        <article className="panel" key={r.id}>
          <h2>
            {r.name} · {labels[r.status]}
          </h2>

          <p>{r.body}</p>
          <small>{date(r.created_at)}</small>
          <p>{r.resolution}</p>

          {r.status === "pending" &&
            ["accepted", "rejected"].map((status) => (
              <button
                key={status}
                disabled={a.busy}
                className={
                  status === "rejected" ? "danger" : ""
                }
                onClick={() => {
                  const resolution = prompt(
                    "Explica tu decisión (mínimo 10 caracteres)",
                  );

                  if (resolution) {
                    void a.run(async () => {
                      await api(
                        "/admin/appeals/" + r.id,
                        "PATCH",
                        { status, resolution },
                      );
                      await q.reload();
                    });
                  }
                }}
              >
                {status === "accepted"
                  ? "Aceptar y reactivar"
                  : "Rechazar"}
              </button>
            ))}
        </article>
      ))}
    </>
  );
}

function Analytics() {
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );

  const q = useData<Metrics>(
    "/admin/analytics?month=" + month,
  );

  const [tutor, setTutor] = useState("");

  return (
    <>
      <h2>Indicadores</h2>

      <Field label="Mes de sesiones y demanda">
        <input
          type="month"
          value={month}
          onChange={(e) => {
            if (e.target.value) {
              setMonth(e.target.value);
            }
          }}
        />
      </Field>

      <Status {...q} />

      {q.data && (
        <>
          <section className="panel">
            <h3>Horas contratadas por categoría</h3>

            <p>
              Sesiones aprobadas o impartidas cuya fecha de
              inicio cae dentro del mes.
            </p>

            <div className="chart">
              <ResponsiveContainer
                width="100%"
                height={280}
              >
                <BarChart data={q.data.demand}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="hours"
                    name="Horas"
                    fill="#137c66"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Horas</th>
                </tr>
              </thead>

              <tbody>
                {q.data.demand.map((d) => (
                  <tr key={d.name}>
                    <td>{d.name}</td>
                    <td>{d.hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3>Tutorías del mes por estado</h3>

            <div className="chart">
              <ResponsiveContainer
                width="100%"
                height={260}
              >
                <BarChart
                  data={q.data.sessions.map((s) => ({
                    ...s,
                    name: labels[s.status],
                  }))}
                >
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#e1a342" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {q.data.sessions.map((s) => (
              <p key={s.status}>
                {labels[s.status]}: {s.total}
              </p>
            ))}
          </section>

          <div className="grid two">
            {[false, true].map((reverse) => (
              <section
                className="panel"
                key={String(reverse)}
              >
                <h3>
                  {reverse ? "Menor" : "Mayor"} calificación
                  histórica
                </h3>

                {(reverse
                  ? [...q.data!.rankings].reverse()
                  : q.data!.rankings
                )
                  .slice(0, 10)
                  .map((r) => (
                    <p key={r.id}>
                      <button
                        className="secondary"
                        onClick={() => setTutor(r.id)}
                      >
                        {r.name}: {r.rating.toFixed(2)} ★ (
                        {r.reviews} reseñas)
                      </button>
                    </p>
                  ))}
              </section>
            ))}
          </div>

          {tutor && <Reviews id={tutor} />}
        </>
      )}
    </>
  );
}

function Reviews({ id }: { id: string }) {
  const q = useData<Review[]>(
    "/tutors/" + id + "/reviews",
  );

  return (
    <section className="panel">
      <h3>Reseñas del tutor seleccionado</h3>

      <Status {...q} />

      {q.data?.map((r, i) => (
        <p key={i}>
          {r.name} · {r.stars} ★ · {r.comment} ·{" "}
          {date(r.created_at)}
        </p>
      ))}
    </section>
  );
}

function AuditLog() {
  const q = useData<Audit[]>("/admin/audit");

  return (
    <>
      <h2>Últimos 300 eventos de auditoría</h2>

      <Status {...q} />

      {q.data?.map((r) => (
        <article className="panel" key={r.id}>
          <strong>{r.action}</strong>

          <p>
            {date(r.created_at)} · {r.target}
          </p>

          <pre>{JSON.stringify(r.detail, null, 2)}</pre>
        </article>
      ))}
    </>
  );
}