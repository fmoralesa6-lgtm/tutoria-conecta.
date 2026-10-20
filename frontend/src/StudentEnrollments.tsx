import {
  useData,
  Status,
  labels,
  date,
  money,
} from "./ui";

type Session = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
};

type Enrollment = {
  id: string;
  title: string;
  tutor_name: string;
  modality: string;
  weeks: number;
  status: string;
  created_at: string;
  class_cost: number | string;
  travel_cost: number | string;
  sessions: Session[];
};

type Response = {
  student: {
    id: string;
    name: string;
    email: string;
  };
  subscriptions: Enrollment[];
};

export default function StudentEnrollments({
  studentId,
  close,
}: {
  studentId: string;
  close: () => void;
}) {
  const q = useData<Response>(
    "/admin/users/" + studentId + "/subscriptions",
  );

  return (
    <section
      className="panel"
      aria-label="Inscripciones del estudiante"
    >
      <div className="card-bottom">
        <h2>Inscripciones y horarios</h2>

        <div>
          <button
            type="button"
            className="secondary"
            disabled={q.loading}
            onClick={() => void q.reload()}
          >
            Actualizar
          </button>

          <button
            type="button"
            className="secondary"
            onClick={close}
          >
            Cerrar
          </button>
        </div>
      </div>

      <Status {...q} />

      {!q.loading && !q.error && q.data && (
        <>
          <h3>{q.data.student.name}</h3>
          <p>{q.data.student.email}</p>

          <p>
            {q.data.subscriptions.length} inscripciones
            registradas. Horarios de Guatemala (UTC−6).
          </p>

          {q.data.subscriptions.length === 0 && (
            <p>
              Este estudiante todavía no tiene
              inscripciones.
            </p>
          )}

          {q.data.subscriptions.map((sub) => (
            <article className="panel" key={sub.id}>
              <div className="card-bottom">
                <h3>{sub.title}</h3>

                <span className="pill">
                  {labels[sub.status] || sub.status}
                </span>
              </div>

              <p>
                <strong>Tutor:</strong> {sub.tutor_name}
              </p>

              <p>
                <strong>Modalidad:</strong>{" "}
                {labels[sub.modality] || sub.modality}
                {" · "}
                {sub.weeks} semanas
              </p>

              <p>
                <strong>Inscripción:</strong>{" "}
                {date(sub.created_at)}
              </p>

              <p>
                <strong>Presupuesto del bloque:</strong>{" "}
                {money(
                  Number(sub.class_cost) +
                    Number(sub.travel_cost),
                )}
              </p>

              <p>
                {sub.sessions.length} sesiones ·{" "}
                {
                  sub.sessions.filter(
                    (s) => s.status === "completed",
                  ).length
                }{" "}
                impartidas ·{" "}
                {
                  sub.sessions.filter(
                    (s) => s.status === "cancelled",
                  ).length
                }{" "}
                canceladas
              </p>

              <details>
                <summary>
                  Ver fechas y horarios (
                  {sub.sessions.length})
                </summary>

                {sub.sessions.length === 0 ? (
                  <p>No hay sesiones registradas.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <caption>
                        Sesiones de {sub.title} · Guatemala
                      </caption>

                      <thead>
                        <tr>
                          <th scope="col">Inicio</th>
                          <th scope="col">Fin</th>
                          <th scope="col">Duración</th>
                          <th scope="col">Estado</th>
                        </tr>
                      </thead>

                      <tbody>
                        {sub.sessions.map((session) => (
                          <tr key={session.id}>
                            <td>
                              {date(session.start_at)}
                            </td>

                            <td>
                              {date(session.end_at)}
                            </td>

                            <td>
                              {Math.round(
                                (new Date(
                                  session.end_at,
                                ).getTime() -
                                  new Date(
                                    session.start_at,
                                  ).getTime()) /
                                  60000,
                              )}{" "}
                              min
                            </td>

                            <td>
                              {labels[session.status] ||
                                session.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            </article>
          ))}
        </>
      )}
    </section>
  );
}