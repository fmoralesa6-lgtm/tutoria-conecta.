import { useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { Field, Notice, Status, useAction, useData } from "./ui";
import type { Category } from "./types";
import Map from "./Map";
export default function Onboarding() {
  const { refresh } = useAuth(),
    a = useAction(),
    cats = useData<Category[]>("/categories");
  const [role, setRole] = useState("student"),
    [point, setPoint] = useState<[number, number] | null>(null),
    [affinities, setAffinities] = useState<string[]>([]);
  return (
    <section className="panel">
      <p className="eyebrow">PRIMER PASO</p>
      <h1>Completa tu perfil</h1>
      <p>
        Fija tu ubicación en el mapa. Tu documento y dirección no se muestran en
        el catálogo público.
      </p>
      <Notice {...a} />
      <Status {...cats} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void a.run(async () => {
            if (!point) throw Error("Selecciona un punto en el mapa");
            await api("/auth/onboarding", "POST", {
              role,
              phone: f.get("phone"),
              gender: f.get("gender"),
              address: f.get("address"),
              document: f.get("document"),
              lat: point[0],
              lng: point[1],
              affinities,
              ...(role === "tutor"
                ? {
                    portfolio: f.get("portfolio"),
                    bio: f.get("bio"),
                    hourly_rate: Number(f.get("rate")),
                  }
                : {}),
            });
            await refresh();
          });
        }}
      >
        <div className="grid two">
          <Field label="Rol principal">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">Estudiante</option>
              <option value="tutor">Tutor</option>
            </select>
          </Field>
          <Field label="Teléfono / WhatsApp">
            <input name="phone" required minLength={8} maxLength={25} />
          </Field>
          <Field label="Género">
            <select name="gender" required>
              <option value="">Seleccionar</option>
              <option>Femenino</option>
              <option>Masculino</option>
              <option>No binario</option>
              <option>Prefiero no indicar</option>
            </select>
          </Field>
          <Field label="Número de documento de identificación">
            <input name="document" required minLength={6} maxLength={40} />
          </Field>
        </div>
        <Field label="Dirección habitual">
          <input name="address" required minLength={8} maxLength={300} />
        </Field>
        <p>
          Haz clic para fijar tu ubicación:{" "}
          {point
            ? point.map((n) => n.toFixed(5)).join(", ")
            : "sin seleccionar"}
        </p>
        <Map
          lat={point?.[0]}
          lng={point?.[1]}
          onChange={(lat, lng) => setPoint([lat, lng])}
        />
        <fieldset>
          <legend>Categorías de interés</legend>
          {cats.data?.map((c) => (
            <label className="check" key={c.id}>
              <input
                type="checkbox"
                checked={affinities.includes(c.id)}
                onChange={(e) =>
                  setAffinities(
                    e.target.checked
                      ? [...affinities, c.id]
                      : affinities.filter((x) => x !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </fieldset>
        {role === "tutor" && (
          <>
            <Field label="URL HTTPS de portafolio o credenciales académicas">
              <input
                name="portfolio"
                type="url"
                required
                placeholder="https://…"
              />
            </Field>
            <Field label="Biografía profesional">
              <textarea name="bio" minLength={20} maxLength={3000} required />
            </Field>
            <Field label="Tarifa base por hora (Q)">
              <input
                name="rate"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                required
              />
            </Field>
            <p>Tu perfil quedará pendiente de aprobación administrativa.</p>
          </>
        )}
        <button disabled={a.busy}>Guardar perfil</button>
      </form>
    </section>
  );
}
