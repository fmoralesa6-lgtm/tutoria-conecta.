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
import type { Appeal, Report } from "./types";
export function Policies() {
  return (
    <details className="panel">
      <summary>Políticas de convivencia</summary>
      <p>
        Trata con respeto a estudiantes y tutores. No se admite acoso,
        discriminación, amenazas ni uso indebido de datos personales. Acuerda
        los horarios y respeta el presupuesto. Reporta inasistencias, conductas
        inapropiadas o cobros no acordados con evidencia textual.
      </p>
      <p>
        La administración revisa las denuncias y puede suspender cuentas
        indicando el motivo. La persona suspendida puede presentar una
        apelación. Solo su aceptación administrativa reactiva la cuenta. No
        compartas documentos o direcciones ajenas por chat. Esta plataforma
        académica no procesa pagos ni emite certificaciones oficiales.
      </p>
    </details>
  );
}
export function Suspended() {
  const { state, refresh } = useAuth(),
    a = useAction(),
    q = useData<Appeal[]>("/auth/appeals");
  return (
    <>
      <section className="panel">
        <p className="eyebrow">ACCESO RESTRINGIDO</p>
        <h1>Cuenta suspendida</h1>
        <p>Motivo: {state.user?.suspension_reason}</p>
        <p>
          Fecha: {state.user?.suspended_at && date(state.user.suspended_at)}
        </p>
        <a href="#politicas">Consultar políticas de convivencia</a>
        <Notice {...a} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void a.run(async () => {
              await api("/auth/appeals", "POST", { body: f.get("body") });
              await q.reload();
            }, "Apelación enviada");
          }}
        >
          <Field label="Expón tu caso ante la administración">
            <textarea name="body" required minLength={20} maxLength={4000} />
          </Field>
          <button
            disabled={a.busy || !!q.data?.some((x) => x.status === "pending")}
          >
            Enviar apelación formal
          </button>
        </form>
        <button className="secondary" onClick={() => void refresh()}>
          Comprobar resolución
        </button>
        <Status {...q} />
        {q.data?.map((r) => (
          <article className="review" key={r.id}>
            <p>
              {labels[r.status]} · {date(r.created_at)}
            </p>
            <p>{r.body}</p>
            <p>{r.resolution}</p>
          </article>
        ))}
      </section>
      <div id="politicas">
        <Policies />
      </div>
    </>
  );
}
export function Profile() {
  const { state } = useAuth(),
    u = state.user!;
  return (
    <section className="panel">
      <h1>Mi perfil</h1>
      <div className="identity">
        <img src={u.picture} alt="" />
        <h2>{u.name}</h2>
      </div>
      <p>
        {u.email} · {labels[u.role]}
      </p>
      <p>
        {u.phone} · {u.gender}
      </p>
      <p>{u.address}</p>
      <p>
        Coordenadas: {u.lat}, {u.lng}
      </p>
      {u.role === "tutor" && (
        <>
          <p>{u.bio}</p>
          <p>Tarifa base: {money(u.hourly_rate || 0)}</p>
          <p>{u.approved ? "Tutor aprobado" : "Pendiente de aprobación"}</p>
        </>
      )}
      <Policies />
    </section>
  );
}
export function ReportForm() {
  const a = useAction(),
    q = useData<Report[]>("/reports/mine"),
    contacts = useData<{ id: string; name: string }[]>("/contacts");
  return (
    <>
      <section className="panel">
        <h1>Reportar conducta</h1>
        <p>
          Selecciona una persona con quien tienes sesiones o conversaciones.
          Describe los hechos con claridad.
        </p>
        <Notice {...a} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void a.run(async () => {
              await api("/reports", "POST", {
                target_id: f.get("target"),
                reason: f.get("reason"),
                evidence: f.get("evidence"),
              });
              await q.reload();
            }, "Denuncia registrada");
          }}
        >
          <Status {...contacts} />
          <Field label="Persona a reportar">
            <select name="target" required>
              <option value="">Seleccionar persona</option>
              {contacts.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motivo">
            <select name="reason">
              <option>inasistencia</option>
              <option>conducta inapropiada</option>
              <option>cobros indebidos</option>
            </select>
          </Field>
          <Field label="Evidencia textual: fechas, hechos y mensajes relevantes">
            <textarea
              name="evidence"
              required
              minLength={20}
              maxLength={4000}
            />
          </Field>
          <button disabled={a.busy}>Enviar reporte</button>
        </form>
      </section>
      <Status {...q} />
      {q.data?.map((r) => (
        <article className="panel" key={r.id}>
          <h3>
            {r.reason} · {labels[r.status]}
          </h3>
          <p>{r.evidence}</p>
          <p>{r.resolution}</p>
        </article>
      ))}
    </>
  );
}
