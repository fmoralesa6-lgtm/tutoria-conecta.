import { useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { Field, Notice, Status, useAction, useData, days, money } from "./ui";
import type { Category, Offer, Block } from "./types";
import { clock } from "./Catalog";

export default function Tutor() {
  const { state } = useAuth();
  const action = useAction();
  const categories = useData<Category[]>("/categories");
  const offers = useData<Offer[]>("/offers/mine");
  const availability = useData<Block[]>(`/availability/${state.user!.id}`);

  const [editing, setEditing] = useState<Offer | null>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);

  return (
    <>
      <h1>Mi espacio de tutor</h1>

      <p className="pill">
        {state.user?.approved
          ? "Perfil aprobado"
          : "Pendiente de aprobación administrativa"}
      </p>

      <Notice {...action} />

      <section className="panel">
        <h2>Disponibilidad semanal</h2>
        <p>
          Horarios de Guatemala. Guardar cambios no cancela las reservas
          existentes.
        </p>

        <Status {...availability} />

        {(blocks || availability.data || []).map((block, index) => (
          <div className="row" key={index}>
            <span>
              {days[block.weekday]} · {clock(block.start_min)}–
              {clock(block.end_min)}
            </span>

            <button
              type="button"
              className="secondary"
              onClick={() =>
                setBlocks(
                  (blocks || availability.data || []).filter(
                    (_, blockIndex) => blockIndex !== index,
                  ),
                )
              }
            >
              Quitar
            </button>
          </div>
        ))}

        <form
          onSubmit={(event) => {
            event.preventDefault();

            const formData = new FormData(event.currentTarget);

            const toMinutes = (value: FormDataEntryValue | null) =>
              String(value)
                .split(":")
                .reduce((hours, minutes) => hours * 60 + Number(minutes), 0);

            setBlocks([
              ...(blocks || availability.data || []),
              {
                weekday: Number(formData.get("day")),
                start_min: toMinutes(formData.get("start")),
                end_min: toMinutes(formData.get("end")),
              },
            ]);
          }}
        >
          <div className="grid three">
            <Field label="Día">
              <select name="day">
                {days.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
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

          <button type="submit" className="secondary">
            Agregar bloque
          </button>
        </form>

        <button
          type="button"
          disabled={action.busy || availability.loading}
          onClick={() =>
            void action.run(async () => {
              await api(
                "/availability",
                "PUT",
                blocks || availability.data || [],
              );

              await availability.reload();
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
          onSubmit={(event) => {
            event.preventDefault();

            const form = event.currentTarget;
            const formData = new FormData(form);

            void action.run(async () => {
              const body = {
                category_id: formData.get("category"),
                title: formData.get("title"),
                description: formData.get("description"),
                hourly_rate: Number(formData.get("rate")),
                km_rate: Number(formData.get("km")),
                modalities: formData.getAll("modality"),
                active: formData.get("active") === "on",
              };

              await api(
                "/offers" + (editing ? `/${editing.id}` : ""),
                editing ? "PUT" : "POST",
                body,
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
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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

            {["virtual", "tutor_home", "student_home"].map(
              (modality, index) => (
                <label className="check" key={modality}>
                  <input
                    name="modality"
                    type="checkbox"
                    value={modality}
                    defaultChecked={
                      editing
                        ? editing.modalities.includes(modality)
                        : index === 0
                    }
                  />

                  {modality === "virtual"
                    ? "Virtual"
                    : modality === "tutor_home"
                      ? "En mi sede"
                      : "A domicilio"}
                </label>
              ),
            )}
          </fieldset>

          <label className="check">
            <input
              name="active"
              type="checkbox"
              defaultChecked={editing?.active ?? true}
            />
            Activa
          </label>

          <button
            type="submit"
            disabled={action.busy || !state.user?.approved}
          >
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
        {offers.data?.map((offer) => (
          <article className="panel" key={offer.id}>
            <h3>{offer.title}</h3>

            <p>
              {money(offer.hourly_rate)} / hora ·{" "}
              {offer.active ? "Activa" : "Inactiva"}
            </p>

            <button type="button" onClick={() => setEditing(offer)}>
              Editar
            </button>
          </article>
        ))}
      </div>
    </>
  );
}