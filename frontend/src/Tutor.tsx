import { useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { Field, Notice, Status, useAction, useData, days, money } from "./ui";
import type { Category, Offer, Block } from "./types";
import { clock } from "./Catalog";
import Classrooms from "./Classrooms";
export default function Tutor() {
  const { state } = useAuth(),
    a = useAction(),
    cats = useData<Category[]>("/categories"),
    offers = useData<Offer[]>("/offers/mine"),
    av = useData<Block[]>("/availability/" + state.user!.id);
  const [editing, setEditing] = useState<Offer | null>(null),
    [blocks, setBlocks] = useState<Block[] | null>(null);
  return (
    <>
      <h1>Mi espacio de tutor</h1>
      <p className="pill">
        {state.user?.approved
          ? "Perfil aprobado"
          : "Pendiente de aprobación administrativa"}
      </p>
           <Classrooms />
      <Notice {...a} />
      <section className="panel">
        <h2>Disponibilidad semanal</h2>
        <p>
          Horarios de Guatemala. Guardar cambios no cancela las reservas
          existentes.
        </p>
        <Status {...av} />
        {(blocks || av.data || []).map((b, i) => (
          <div className="row" key={i}>
            <span>
              {days[b.weekday]} · {clock(b.start_min)}–{clock(b.end_min)}
            </span>
            <button
              className="secondary"
              onClick={() =>
                setBlocks((blocks || av.data || []).filter((_, j) => j !== i))
              }
            >
              Quitar
            </button>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const minute = (x: FormDataEntryValue | null) =>
              String(x)
                .split(":")
                .reduce((h, m) => h * 60 + Number(m), 0);
            setBlocks([
              ...(blocks || av.data || []),
              {
                weekday: Number(f.get("day")),
                start_min: minute(f.get("start")),
                end_min: minute(f.get("end")),
              },
            ]);
          }}
        >
          <div className="grid three">
            <Field label="Día">
              <select name="day">
                {days.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Desde">
              <input name="start" type="time" required />
            </Field>
            <Field label="Hasta">
              <input name="end" type="time" required />
            </Field>
          </div>
          <button className="secondary">Agregar bloque</button>
        </form>
        <button
          disabled={a.busy || av.loading}
          onClick={() =>
            void a.run(async () => {
              await api("/availability", "PUT", blocks || av.data || []);
              await av.reload();
              setBlocks(null);
            })
          }
        >
          Guardar disponibilidad
        </button>
      </section>
      <section className="panel">
        <h2>{editing ? "Editar tutoría" : "Publicar tutoría"}</h2>
        <form
          key={editing?.id || "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            void a.run(async () => {
              const b = {
                category_id: f.get("category"),
                title: f.get("title"),
                description: f.get("description"),
                hourly_rate: Number(f.get("rate")),
                km_rate: Number(f.get("km")),
                modalities: f.getAll("modality"),
                active: f.get("active") === "on",
              };
              await api(
                "/offers" + (editing ? "/" + editing.id : ""),
                editing ? "PUT" : "POST",
                b,
              );
              setEditing(null);
              form.reset();
              await offers.reload();
            });
          }}
        >
          <Field label="Título">
            <input
              name="title"
              defaultValue={editing?.title}
              required
              minLength={5}
              maxLength={120}
            />
          </Field>
          <Field label="Descripción">
            <textarea
              name="description"
              defaultValue={editing?.description}
              required
              minLength={20}
              maxLength={2000}
            />
          </Field>
          <Field label="Categoría aprobada">
            <select
              name="category"
              defaultValue={editing?.category_id}
              required
            >
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid two">
            <Field label="Q por hora">
              <input
                name="rate"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={editing?.hourly_rate || state.user?.hourly_rate}
              />
            </Field>
            <Field label="Q por kilómetro de traslado">
              <input
                name="km"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={editing?.km_rate || 0}
              />
            </Field>
          </div>
          <fieldset>
            <legend>Modalidades</legend>
            {["virtual", "tutor_home", "student_home"].map((m, i) => (
              <label className="check" key={m}>
                <input
                  name="modality"
                  type="checkbox"
                  value={m}
                  defaultChecked={
                    editing ? editing.modalities.includes(m) : i === 0
                  }
                />
                {m === "virtual"
                  ? "Virtual"
                  : m === "tutor_home"
                    ? "En mi sede"
                    : "A domicilio"}
              </label>
            ))}
          </fieldset>
          <label className="check">
            <input
              name="active"
              type="checkbox"
              defaultChecked={editing?.active ?? true}
            />
            Activa
          </label>
          <button disabled={a.busy || !state.user?.approved}>
            Guardar tutoría
          </button>
          {editing && (
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar edición
            </button>
          )}
        </form>
      </section>
      <Status {...offers} />
      <div className="grid cards">
        {offers.data?.map((o) => (
          <article className="panel" key={o.id}>
            <h3>{o.title}</h3>
            <p>
              {money(o.hourly_rate)} / hora · {o.active ? "Activa" : "Inactiva"}
            </p>
            <button onClick={() => setEditing(o)}>Editar</button>
          </article>
        ))}
      </div>
    </>
  );
}
