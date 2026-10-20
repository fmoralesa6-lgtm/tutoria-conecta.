import { useEffect, useState } from "react";
import { api } from "./api";
import {
  Field,
  Notice,
  days,
  labels,
  money,
  useAction,
} from "./ui";
import type { Offer, Quote } from "./types";
import Map from "./Map";

type Option = {
  minute: number;
  available: boolean;
  reason: string;
};

type Availability = {
  options: Option[];
};

function clock(minute: number) {
  return `${Math.floor(minute / 60)
    .toString()
    .padStart(2, "0")}:${(minute % 60)
    .toString()
    .padStart(2, "0")}`;
}

export default function BookingForm({
  offer,
}: {
  offer: Offer;
}) {
  const a = useAction();

  const [settings, setSettings] = useState({
    modality: offer.modalities[0],
    weeks: 4,
    start_date: "",
    duration: 60,
  });

  const [selectedDays, setDays] = useState<number[]>([1]);
  const [minute, setMinute] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [revision, setRevision] = useState(0);

  const [result, setResult] = useState<{
    key: string;
    data?: Availability;
    error?: string;
  } | null>(null);

  const valid =
    !!settings.start_date &&
    selectedDays.length > 0 &&
    Number.isInteger(settings.duration) &&
    settings.duration >= 30 &&
    settings.duration <= 480;

  const request = JSON.stringify({
    offer_id: offer.id,
    weeks: settings.weeks,
    start_date: settings.start_date,
    duration: settings.duration,
    days: selectedDays,
  });

  const key = request + ":" + revision;

  useEffect(() => {
    let active = true;

    if (!valid) return;

    api<Availability>(
      "/available-times",
      "POST",
      JSON.parse(request),
    )
      .then((data) => {
        if (active) setResult({ key, data });
      })
      .catch((error: Error) => {
        if (active) {
          setResult({ key, error: error.message });
        }
      });

    return () => {
      active = false;
    };
  }, [request, key, valid]);

  const current = result?.key === key ? result : null;
  const loading = valid && !current;
  const options = current?.data?.options ?? [];

  const selected =
    minute !== "" &&
    options.some(
      (o) => o.minute === Number(minute) && o.available,
    );

  const ready = valid && !!current?.data && selected;

  const payload = {
    ...settings,
    offer_id: offer.id,
    days: selectedDays,
    minute: Number(minute),
  };

  function change(patch: Partial<typeof settings>) {
    setSettings((old) => ({ ...old, ...patch }));
    setMinute("");
    setQuote(null);
  }

  function reload() {
    setMinute("");
    setQuote(null);
    setRevision((n) => n + 1);
  }

  return (
    <section>
      <h3>Contratar bloque recurrente</h3>

      <p>
        Horarios de Guatemala (UTC−6). Se revisan todas las
        fechas del bloque, tanto para el tutor como para ti.
      </p>

      <Notice {...a} />

      <fieldset disabled={a.busy}>
        <legend>Configura tus sesiones</legend>

        <div className="grid two">
          <Field label="Modalidad">
            <select
              value={settings.modality}
              onChange={(e) =>
                change({ modality: e.target.value })
              }
            >
              {offer.modalities.map((m) => (
                <option key={m} value={m}>
                  {labels[m]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Duración del bloque">
            <select
              value={settings.weeks}
              onChange={(e) =>
                change({ weeks: Number(e.target.value) })
              }
            >
              <option value={4}>4 semanas</option>
              <option value={8}>8 semanas</option>
            </select>
          </Field>

          <Field label="Fecha inicial">
            <input
              type="date"
              value={settings.start_date}
              onChange={(e) =>
                change({ start_date: e.target.value })
              }
            />
          </Field>

          <Field label="Minutos por sesión">
            <input
              type="number"
              min={30}
              max={480}
              step={30}
              value={settings.duration}
              onChange={(e) =>
                change({
                  duration: Number(e.target.value),
                })
              }
            />
          </Field>
        </div>

        <fieldset>
          <legend>Días fijos</legend>

          {days.map((day, index) => (
            <label className="check" key={day}>
              <input
                type="checkbox"
                checked={selectedDays.includes(index)}
                onChange={(e) => {
                  setDays(
                    e.target.checked
                      ? [...selectedDays, index].sort()
                      : selectedDays.filter(
                          (d) => d !== index,
                        ),
                  );
                  setMinute("");
                  setQuote(null);
                }}
              />
              {day}
            </label>
          ))}
        </fieldset>

        {!valid && (
          <p>
            Selecciona la fecha, al menos un día y una
            duración entre 30 y 480 minutos.
          </p>
        )}

        {loading && (
          <p role="status">
            Revisando horarios de todas las semanas…
          </p>
        )}

        <Notice error={current?.error} />

        {current?.data && (
          <>
            <Field label="Hora fija para todas las sesiones">
              <select
                value={minute}
                onChange={(e) => {
                  setMinute(e.target.value);
                  setQuote(null);
                }}
              >
                <option value="">
                  Selecciona un horario
                </option>

                {options.map((o) => (
                  <option
                    key={o.minute}
                    value={o.minute}
                    disabled={!o.available}
                  >
                    {clock(o.minute)}–
                    {clock(o.minute + settings.duration)}
                    {" · "}
                    {o.available
                      ? "Disponible"
                      : o.reason}
                  </option>
                ))}
              </select>
            </Field>

            {options.length === 0 ? (
              <p>
                No hay un horario semanal común para esos
                días y duración. Prueba otros días o una
                sesión más corta.
              </p>
            ) : !options.some((o) => o.available) ? (
              <p>
                Todos los horarios tienen algún conflicto.
                Cambia la fecha, los días o la duración.
              </p>
            ) : (
              <p>
                Los horarios deshabilitados tienen algún
                conflicto durante el bloque. No se elimina
                la disponibilidad semanal.
              </p>
            )}
          </>
        )}

        <button
          type="button"
          className="secondary"
          disabled={!valid || loading}
          onClick={reload}
        >
          Actualizar horarios
        </button>

        <button
          type="button"
          disabled={!ready || a.busy}
          onClick={() =>
            void a.run(async () => {
              setQuote(null);
              setQuote(
                await api<Quote>(
                  "/quote",
                  "POST",
                  payload,
                ),
              );
            }, "Presupuesto calculado")
          }
        >
          Calcular presupuesto
        </button>

        {quote && ready && (
          <div className="panel">
            <p>
              {quote.sessions} sesiones ·{" "}
              {quote.distance_km.toFixed(2)} km de ruta
              por sesión
            </p>

            <p>Clases: {money(quote.class_cost)}</p>
            <p>Traslados: {money(quote.travel_cost)}</p>
            <h3>Total: {money(quote.total)}</h3>

            {quote.route && <Map route={quote.route} />}

            <p>{quote.notice}</p>

            <button
              type="button"
              disabled={a.busy}
              onClick={() =>
                void a.run(async () => {
                  try {
                    await api(
                      "/subscriptions",
                      "POST",
                      payload,
                    );
                  } finally {
                    reload();
                  }
                }, "Solicitud enviada. Revisa tu agenda. Las sesiones pendientes ya reservan el horario.")
              }
            >
              Confirmar solicitud
            </button>
          </div>
        )}
      </fieldset>

      <p>
        La disponibilidad se consulta al cambiar los datos o
        pulsar «Actualizar horarios». Al confirmar, el
        servidor vuelve a comprobar la reserva.
      </p>
    </section>
  );
}