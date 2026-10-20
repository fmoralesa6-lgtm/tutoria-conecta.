import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import es from "@fullcalendar/core/locales/es";
import { api } from "./api";
import { useAuth } from "./auth";
import {
  Field,
  Notice,
  Status,
  useAction,
  useData,
  date,
  labels,
  money,
} from "./ui";
import type { Session } from "./types";
export default function Agenda() {
  const { state } = useAuth(),
    q = useData<Session[]>("/sessions"),
    a = useAction();
  const [selected, setSelected] = useState<Session | null>(null);
  const act = (fn: () => Promise<unknown>) =>
    void a.run(async () => {
      await fn();
      await q.reload();
      setSelected(null);
    });
  const colors: Record<string, string> = {
    pending: "#b16b0c",
    approved: "#137c66",
    completed: "#385dc9",
    cancelled: "#7f8c89",
  };
  const events = q.data?.map((s) => ({
    id: s.id,
    title: s.title + " · " + labels[s.status],
    start: new Date(new Date(s.start_at).getTime() - 21600000)
      .toISOString()
      .slice(0, -1),
    end: new Date(new Date(s.end_at).getTime() - 21600000)
      .toISOString()
      .slice(0, -1),
    backgroundColor: colors[s.status],
    borderColor: colors[s.status],
  }));
  return (
    <>
      <h1>Mi agenda</h1>
      <p>
        Zona horaria: Guatemala (UTC−6). Pulsa una sesión para ver sus acciones.
      </p>
      <Notice {...a} />
      <Status {...q} />
      <section className="panel calendar">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={es}
          timeZone="UTC"
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={events}
          height="auto"
          allDaySlot={false}
          eventClick={(e) =>
            setSelected(q.data?.find((s) => s.id === e.event.id) || null)
          }
        />
      </section>
      <details>
        <summary>Lista accesible de sesiones</summary>
        {q.data?.map((s) => (
          <button
            className="secondary session-button"
            key={s.id}
            onClick={() => setSelected(s)}
          >
            {date(s.start_at)} · {s.title} · {labels[s.status]}
          </button>
        ))}
      </details>
      {selected && (
        <section className="panel">
          <h2>{selected.title}</h2>
          <p>
            {date(selected.start_at)} — {date(selected.end_at)}
          </p>
          <p>
            Tutor: {selected.tutor_name} · Estudiante: {selected.student_name}
          </p>
          <p>
            {labels[selected.status]} · {labels[selected.modality]} · Bloque de{" "}
            {selected.weeks} semanas
          </p>
          <p>
            Presupuesto del bloque: clases {money(selected.class_cost)} +
            traslado {money(selected.travel_cost)}
          </p>
          {state.user?.role === "tutor" && selected.status === "pending" && (
            <button
              disabled={a.busy}
              onClick={() =>
                act(() =>
                  api("/subscriptions/" + selected.subscription_id, "PATCH", {
                    status: "approved",
                  }),
                )
              }
            >
              Aprobar bloque
            </button>
          )}
          {["pending", "approved"].includes(selected.status) && (
            <button
              className="danger"
              disabled={a.busy}
              onClick={() => {
                if (
                  confirm(
                    "¿Cancelar todas las sesiones pendientes o aprobadas de este bloque?",
                  )
                )
                  act(() =>
                    api("/subscriptions/" + selected.subscription_id, "PATCH", {
                      status: "cancelled",
                    }),
                  );
              }}
            >
              Cancelar bloque
            </button>
          )}
          {state.user?.role === "tutor" &&
            selected.status === "approved" &&
            new Date(selected.end_at) < new Date() && (
              <button
                disabled={a.busy}
                onClick={() =>
                  act(() =>
                    api("/sessions/" + selected.id + "/complete", "POST", {}),
                  )
                }
              >
                Marcar impartida
              </button>
            )}
          {state.user?.role === "student" &&
            selected.status === "completed" &&
            !selected.review_id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  act(() =>
                    api("/sessions/" + selected.id + "/reviews", "POST", {
                      stars: Number(f.get("stars")),
                      comment: f.get("comment"),
                    }),
                  );
                }}
              >
                <Field label="Calificación">
                  <select name="stars">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} estrellas
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reseña">
                  <textarea
                    name="comment"
                    minLength={5}
                    maxLength={2000}
                    required
                  />
                </Field>
                <button disabled={a.busy}>Publicar reseña</button>
              </form>
            )}
          <button className="secondary" onClick={() => setSelected(null)}>
            Cerrar detalle
          </button>
        </section>
      )}
    </>
  );
}
