import { useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import Classrooms from "./Classrooms";
import {
  Field,
  Notice,
  Status,
  useAction,
  useData,
  money,
  days,
  labels,
  date,
} from "./ui";
import type {
  Offer,
  Category,
  Review,
  Block,
  Conversation,
} from "./types";
import BookingForm from "./BookingForm";

export default function Catalog({
  openChat,
}: {
  openChat: (id: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] =
    useState<Offer | null>(null);

  const offers = useData<Offer[]>("/offers" + filter);
  const cats = useData<Category[]>("/categories");

  const shared = new URLSearchParams(
    location.search,
  ).get("tutor");

  const displayed = offers.data?.filter(
    (o) => !shared || o.tutor_id === shared,
  );

  return (
    <>
      <Classrooms />
      <div className="hero">
        <p className="eyebrow">
          APRENDE CERCA. LLEGA LEJOS.
        </p>
        <h1>Encuentra a tu próximo tutor.</h1>
        <p>
          Clases virtuales, en sede o en tu casa. Una
          agenda que se adapta a ti.
        </p>
      </div>

      <form
        className="panel filters"
        onSubmit={(e) => {
          e.preventDefault();

          const f = new FormData(e.currentTarget);
          const q = new URLSearchParams();

          for (const [k, v] of f) {
            if (String(v)) q.set(k, String(v));
          }

          setFilter("?" + q);
        }}
      >
        <Field label="Categoría">
          <select name="category">
            <option value="">Todas</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Modalidad">
          <select name="modality">
            <option value="">Todas</option>
            {[
              "virtual",
              "tutor_home",
              "student_home",
            ].map((m) => (
              <option key={m} value={m}>
                {labels[m]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Precio mínimo">
          <input name="min" type="number" min="0" />
        </Field>

        <Field label="Precio máximo">
          <input name="max" type="number" min="0" />
        </Field>

        <Field label="Radio de cercanía (km)">
          <input
            name="radius"
            type="number"
            min="0.1"
            step="0.1"
          />
        </Field>

        <Field label="Estrellas mínimas">
          <input
            name="rating"
            type="number"
            min="0"
            max="5"
            step="0.1"
          />
        </Field>

        <Field label="Reseñas mínimas">
          <input
            name="reviews"
            type="number"
            min="0"
          />
        </Field>

        <button>Buscar</button>
      </form>

      <Status {...offers} />

      {shared && (
        <p>
          Perfil compartido.{" "}
          <a href={location.pathname}>
            Ver todos los tutores
          </a>
        </p>
      )}

      <div className="grid cards">
        {displayed?.map((o) => (
          <article className="panel" key={o.id}>
            <span className="pill">{o.category}</span>
            <h2>{o.title}</h2>

            <div className="identity">
              <img src={o.picture} alt="" />
              <strong>{o.name}</strong>
            </div>

            <p>{o.description}</p>
            <p>
              ★ {Number(o.rating).toFixed(1)} ·{" "}
              {o.review_count} reseñas
            </p>
            <p>
              {o.distance_km.toFixed(1)} km de cercanía
            </p>
            <p>
              {o.modalities
                .map((m) => labels[m])
                .join(" · ")}
            </p>

            <div className="card-bottom">
              <strong>
                {money(o.hourly_rate)} / hora
              </strong>
              <button onClick={() => setSelected(o)}>
                Ver tutoría
              </button>
            </div>
          </article>
        ))}
      </div>

      {displayed?.length === 0 && (
        <p>
          No hay ofertas que coincidan. Los tutores deben
          estar aprobados y publicar una oferta.
        </p>
      )}

      {selected && (
        <Detail
          offer={selected}
          close={() => {
            setSelected(null);
            void offers.reload();
          }}
          openChat={openChat}
        />
      )}
    </>
  );
}

function Detail({
  offer: o,
  close,
  openChat,
}: {
  offer: Offer;
  close: () => void;
  openChat: (id: string) => void;
}) {
  const { state } = useAuth();
  const a = useAction();

  const reviews = useData<Review[]>(
    "/tutors/" + o.tutor_id + "/reviews",
  );

  const availability = useData<Block[]>(
    "/availability/" + o.tutor_id,
  );

  const share = encodeURIComponent(
    `${o.name}: ${o.title}. Desde ${money(o.hourly_rate)}/hora. ${location.origin}/?tutor=${o.tutor_id}`,
  );

  return (
    <div className="overlay">
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de tutoría"
      >
        <button className="secondary" onClick={close}>
          Cerrar
        </button>

        <h1>{o.title}</h1>
        <h2>{o.name}</h2>
        <p>{o.bio}</p>
        <p>{o.description}</p>

        <a
          className="button secondary"
          href={"https://wa.me/?text=" + share}
          target="_blank"
          rel="noreferrer"
        >
          Compartir por WhatsApp
        </a>

        <Notice {...a} />

        <h3>Disponibilidad semanal · Guatemala</h3>

        <Status {...availability} />

        {availability.data?.map((b, i) => (
          <p key={i}>
            {days[b.weekday]}: {clock(b.start_min)}–
            {clock(b.end_min)}
          </p>
        ))}

        {state.user?.role === "student" && (
          <>
            <button
              onClick={() =>
                void a.run(async () => {
                  const c = await api<Conversation>(
                    "/conversations",
                    "POST",
                    { tutor_id: o.tutor_id },
                  );
                  openChat(c.id);
                  close();
                }, "Conversación abierta")
              }
            >
              Conversar con tutor
            </button>

            <BookingForm offer={o} />
          </>
        )}

        <h3>Reseñas del tutor</h3>

        <Status {...reviews} />

        {reviews.data?.length === 0 && (
          <p>Todavía no tiene reseñas.</p>
        )}

        {reviews.data?.map((r, i) => (
          <article className="review" key={i}>
            <strong>
              {r.name} · {"★".repeat(r.stars)}
            </strong>
            <p>{r.comment}</p>
            <small>{date(r.created_at)}</small>
          </article>
        ))}
      </section>
    </div>
  );
}

export function clock(n: number) {
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60)
    .toString()
    .padStart(2, "0")}`;
}