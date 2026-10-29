import { useEffect, useRef, useState } from "react";
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

const sessionColors: Record<string, string> = {
  pending: "#98600a",
  approved: "#13745f",
  completed: "#405cc3",
  not_held: "#ad334d",
  cancelled: "#64716e",
};

const sessionLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  completed: "Impartida",
  not_held: "No impartida",
  cancelled: "Cancelada",
};

/*
 * FullCalendar muestra estos valores como horas de Guatemala.
 * La fecha original de la API se conserva para las acciones y detalles.
 */
function calendarDate(value: string) {
  return new Date(new Date(value).getTime() - 6 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, -1);
}

function absenceLabel(party: string | null | undefined) {
  switch (party) {
    case "student":
      return "El estudiante no asistió";
    case "tutor":
      return "El tutor no asistió";
    case "both":
      return "Ninguna de las dos partes asistió";
    case "technical":
      return "Problema técnico";
    default:
      return "Motivo no especificado";
  }
}

export default function Agenda() {
  const { state } = useAuth();
  const q = useData<Session[]>("/sessions");
  const a = useAction();

  const calendarRef = useRef<FullCalendar | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  const [selected, setSelected] = useState<Session | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia("(max-width: 700px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");

    function updateLayout() {
      setIsMobile(media.matches);

      calendarRef.current?.getApi().changeView(
        media.matches ? "timeGridDay" : "timeGridWeek",
      );
    }

    media.addEventListener("change", updateLayout);

    return () => {
      media.removeEventListener("change", updateLayout);
    };
  }, []);

  useEffect(() => {
    if (selected) {
      detailRef.current?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
      detailRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  const sessions = [...(q.data || [])].sort(
    (first, second) =>
      new Date(first.start_at).getTime() -
      new Date(second.start_at).getTime(),
  );

  const pendingCount = sessions.filter(
    (session) => session.status === "pending",
  ).length;

  const approvedCount = sessions.filter(
    (session) => session.status === "approved",
  ).length;

  const completedCount = sessions.filter(
    (session) => session.status === "completed",
  ).length;

  const events = sessions.map((session) => ({
    id: session.id,
    title: session.title,
    start: calendarDate(session.start_at),
    end: calendarDate(session.end_at),
    backgroundColor: sessionColors[session.status] || "#64716e",
    borderColor: sessionColors[session.status] || "#64716e",
    textColor: "#ffffff",
    extendedProps: {
      status:
        sessionLabels[session.status] ||
        labels[session.status] ||
        session.status,
    },
  }));

  const act = (fn: () => Promise<unknown>) =>
    void a.run(async () => {
      await fn();
      await q.reload();
      setSelected(null);
    });

  return (
    <>
      <section className="agenda-heading">
        <div>
          <p className="eyebrow">ORGANIZA TU APRENDIZAJE</p>
          <h1>Mi agenda</h1>
          <p className="agenda-description">
            Consulta tus clases, revisa sus detalles y da seguimiento a
            cada sesión.
          </p>
        </div>

        <div className="agenda-heading-actions">
          <span className="agenda-timezone">
            Guatemala · UTC−6
          </span>

          <button
            type="button"
            className="secondary"
            disabled={q.loading || a.busy}
            onClick={() => void q.reload()}
          >
            {q.loading ? "Actualizando…" : "Actualizar agenda"}
          </button>
        </div>
      </section>

      <Notice {...a} />
      <Status {...q} />

      {q.data && (
        <div className="agenda-stats" aria-label="Resumen de sesiones">
          <article className="agenda-stat">
            <span className="agenda-stat-label">Por aprobar</span>
            <strong>{pendingCount}</strong>
            <span>Sesiones pendientes</span>
          </article>

          <article className="agenda-stat">
            <span className="agenda-stat-label">Confirmadas</span>
            <strong>{approvedCount}</strong>
            <span>Sesiones aprobadas</span>
          </article>

          <article className="agenda-stat">
            <span className="agenda-stat-label">Completadas</span>
            <strong>{completedCount}</strong>
            <span>Sesiones impartidas</span>
          </article>
        </div>
      )}

      <section
        className="panel agenda-calendar-panel"
        aria-label="Calendario de sesiones"
      >
        <div className="agenda-calendar-intro">
          <div>
            <h2>Tu calendario</h2>
            <p>
              Selecciona una sesión para consultar sus detalles.
            </p>
          </div>

          <span className="pill">
            {isMobile ? "Vista para celular" : "Planifica tu semana"}
          </span>
        </div>

        <ul className="agenda-legend" aria-label="Estados de las sesiones">
          {Object.entries(sessionLabels).map(([status, label]) => (
            <li key={status}>
              <span
                className="agenda-status-dot"
                style={{ backgroundColor: sessionColors[status] }}
                aria-hidden="true"
              />
              {label}
            </li>
          ))}
        </ul>

        <div className="calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
            ]}
            locale={es}
            timeZone="UTC"
            initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
            headerToolbar={
              isMobile
                ? {
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridDay",
                  }
                : {
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                  }
            }
            buttonText={{
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
            }}
            events={events}
            height="auto"
            allDaySlot={false}
            nowIndicator
            dayMaxEvents={3}
            displayEventEnd
            slotDuration="00:30:00"
            scrollTime="07:00:00"
            slotLabelFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            eventContent={(eventInfo) => (
              <div className="agenda-event-content">
                <span className="agenda-event-time">
                  {eventInfo.timeText}
                </span>
                <strong>{eventInfo.event.title}</strong>
                <span className="agenda-event-status">
                  {String(eventInfo.event.extendedProps.status)}
                </span>
              </div>
            )}
            eventDidMount={(info) => {
              const status = String(info.event.extendedProps.status);

              info.el.title = `${info.event.title} · ${status}`;
              info.el.setAttribute(
                "aria-label",
                `${info.event.title}. ${info.timeText}. ${status}. Ver detalle`,
              );
            }}
            eventClick={(eventInfo) => {
              const session = sessions.find(
                (item) => item.id === eventInfo.event.id,
              );

              setSelected(session || null);
            }}
          />
        </div>

        <p className="agenda-calendar-note">
          Todos los horarios corresponden a Guatemala. También puedes
          consultar las clases en la lista de sesiones.
        </p>
      </section>

      {!q.loading && !q.error && q.data?.length === 0 && (
        <section className="panel agenda-empty">
          <span className="agenda-empty-icon" aria-hidden="true">
            ◷
          </span>
          <h2>Tu agenda está lista para comenzar</h2>
          <p>
            Aquí aparecerán tus sesiones cuando tengas una inscripción
            registrada.
          </p>
        </section>
      )}

      <details className="panel agenda-session-list" open={isMobile}>
        <summary>
          <span>Lista accesible de sesiones</span>
          <span className="agenda-list-count">{sessions.length}</span>
        </summary>

        <p className="agenda-list-description">
          Sesiones ordenadas por fecha. Selecciona una para ver sus
          acciones.
        </p>

        {sessions.map((session) => (
          <button
            type="button"
            className="secondary session-button"
            key={session.id}
            aria-pressed={selected?.id === session.id}
            onClick={() => setSelected(session)}
          >
            <span
              className="agenda-status-dot"
              style={{
                backgroundColor:
                  sessionColors[session.status] || "#64716e",
              }}
              aria-hidden="true"
            />

            <span className="session-button-copy">
              <strong>{session.title}</strong>
              <span>{date(session.start_at)}</span>
            </span>

            <span className="session-button-status">
              {sessionLabels[session.status] ||
                labels[session.status] ||
                session.status}
            </span>
          </button>
        ))}
      </details>

      {selected && (
        <section
          className="panel agenda-detail"
          ref={detailRef}
          tabIndex={-1}
          aria-label="Detalle de sesión"
        >
          <div className="agenda-detail-heading">
            <div>
              <p className="eyebrow">DETALLE DE SESIÓN</p>
              <h2>{selected.title}</h2>
            </div>

            <span
              className="agenda-detail-status"
              style={{
                backgroundColor:
                  sessionColors[selected.status] || "#64716e",
              }}
            >
              {sessionLabels[selected.status] ||
                labels[selected.status] ||
                selected.status}
            </span>
          </div>

          <div className="agenda-detail-grid">
            <div className="agenda-detail-item">
              <span>Inicio</span>
              <strong>{date(selected.start_at)}</strong>
            </div>

            <div className="agenda-detail-item">
              <span>Fin</span>
              <strong>{date(selected.end_at)}</strong>
            </div>

            <div className="agenda-detail-item">
              <span>Tutor</span>
              <strong>{selected.tutor_name}</strong>
            </div>

            <div className="agenda-detail-item">
              <span>Estudiante</span>
              <strong>{selected.student_name}</strong>
            </div>

            <div className="agenda-detail-item">
              <span>Modalidad</span>
              <strong>
                {labels[selected.modality] || selected.modality}
              </strong>
            </div>

            <div className="agenda-detail-item">
              <span>Duración del bloque</span>
              <strong>
                {selected.weeks}{" "}
                {Number(selected.weeks) === 1 ? "semana" : "semanas"}
              </strong>
            </div>
          </div>

          <div className="agenda-budget">
            <div>
              <span>Presupuesto del bloque</span>
              <strong>
                {money(
                  Number(selected.class_cost) +
                    Number(selected.travel_cost),
                )}
              </strong>
            </div>

            <p>
              Clases: {money(selected.class_cost)}
              {" · "}
              Traslado: {money(selected.travel_cost)}
            </p>
          </div>

          {selected.status === "not_held" && (
            <div className="alert error">
              <strong>
                Motivo registrado: {absenceLabel(selected.absence_party)}
              </strong>
              <p>{selected.absence_details}</p>
            </div>
          )}

          <div className="agenda-detail-actions">
            {state.user?.role === "tutor" &&
              selected.status === "pending" && (
                <button
                  type="button"
                  disabled={a.busy}
                  onClick={() =>
                    act(() =>
                      api(
                        "/subscriptions/" + selected.subscription_id,
                        "PATCH",
                        { status: "approved" },
                      ),
                    )
                  }
                >
                  Aprobar bloque
                </button>
              )}

            {["pending", "approved"].includes(selected.status) && (
              <button
                type="button"
                className="danger"
                disabled={a.busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Cancelar todas las sesiones pendientes o aprobadas de este bloque?",
                    )
                  ) {
                    act(() =>
                      api(
                        "/subscriptions/" + selected.subscription_id,
                        "PATCH",
                        { status: "cancelled" },
                      ),
                    );
                  }
                }}
              >
                Cancelar bloque
              </button>
            )}

            {state.user?.role === "tutor" &&
              selected.status === "approved" &&
              new Date(selected.end_at) <= new Date() && (
                <button
                  type="button"
                  disabled={a.busy}
                  onClick={() =>
                    act(() =>
                      api(
                        "/sessions/" + selected.id + "/complete",
                        "POST",
                        {},
                      ),
                    )
                  }
                >
                  Marcar impartida
                </button>
              )}
          </div>

          {selected.status === "approved" &&
            new Date(selected.end_at) <= new Date() && (
              <form
                className="agenda-result-form"
                key={selected.id + "-absence"}
                onSubmit={(event) => {
                  event.preventDefault();

                  const form = new FormData(event.currentTarget);

                  act(() =>
                    api(
                      "/sessions/" + selected.id + "/not-held",
                      "POST",
                      {
                        absent_party: form.get("absent_party"),
                        details: form.get("details"),
                      },
                    ),
                  );
                }}
              >
                <h3>Registrar sesión no impartida</h3>

                <Field label="¿Qué ocurrió?">
                  <select
                    name="absent_party"
                    defaultValue={
                      state.user?.role === "tutor" ? "student" : "tutor"
                    }
                    disabled={a.busy}
                  >
                    <option value="student">
                      El estudiante no asistió
                    </option>
                    <option value="tutor">
                      El tutor no asistió
                    </option>
                    <option value="both">
                      Ninguna de las dos partes asistió
                    </option>
                    <option value="technical">
                      Problema técnico
                    </option>
                  </select>
                </Field>

                <Field label="Explica brevemente el motivo">
                  <textarea
                    name="details"
                    minLength={10}
                    maxLength={2000}
                    placeholder="Describe lo ocurrido durante esta sesión."
                    disabled={a.busy}
                    required
                  />
                </Field>

                <p>
                  Si indicas que faltó la otra persona, se enviará un
                  reporte de inasistencia a Administración.
                </p>

                <button type="submit" disabled={a.busy}>
                  {a.busy ? "Guardando…" : "Guardar resultado"}
                </button>
              </form>
            )}

          {state.user?.role === "student" &&
            selected.status === "completed" &&
            !selected.review_id && (
              <form
                className="agenda-result-form"
                key={selected.id + "-review"}
                onSubmit={(event) => {
                  event.preventDefault();

                  const form = new FormData(event.currentTarget);

                  act(() =>
                    api(
                      "/sessions/" + selected.id + "/reviews",
                      "POST",
                      {
                        stars: Number(form.get("stars")),
                        comment: form.get("comment"),
                      },
                    ),
                  );
                }}
              >
                <h3>Comparte tu experiencia</h3>
                <p>
                  Tu valoración ayuda a otros estudiantes a encontrar
                  su próximo tutor.
                </p>

                <Field label="Calificación">
                  <select name="stars" disabled={a.busy}>
                    {[5, 4, 3, 2, 1].map((number) => (
                      <option key={number} value={number}>
                        {number}{" "}
                        {number === 1 ? "estrella" : "estrellas"}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Reseña">
                  <textarea
                    name="comment"
                    minLength={5}
                    maxLength={2000}
                    placeholder="Cuéntanos cómo fue tu clase."
                    disabled={a.busy}
                    required
                  />
                </Field>

                <button type="submit" disabled={a.busy}>
                  {a.busy ? "Publicando…" : "Publicar reseña"}
                </button>
              </form>
            )}

          <button
            type="button"
            className="secondary"
            onClick={() => setSelected(null)}
          >
            Cerrar detalle
          </button>
        </section>
      )}
    </>
  );
}