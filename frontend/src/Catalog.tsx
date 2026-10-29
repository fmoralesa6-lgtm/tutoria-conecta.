import { useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
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
  const [selected, setSelected] = useState<Offer | null>(null);

  const offers = useData<Offer[]>("/offers" + filter);
  const cats = useData<Category[]>("/categories");

  const shared = new URLSearchParams(location.search).get("tutor");

  const displayed = offers.data?.filter(
    (offer) => !shared || offer.tutor_id === shared,
  );

  return (
    <>
      <div className="hero">
        <p className="eyebrow">APRENDE CERCA. LLEGA LEJOS.</p>
        <h1>Encuentra a tu próximo tutor.</h1>
        <p>Clases virtuales, en sede o en tu casa. Una agenda que se adapta a ti.</p>
      </div>

      <form
        className="panel filters"
        onSubmit={(event) => {
          event.preventDefault();

          const formData = new FormData(event.currentTarget);
          const query = new URLSearchParams();

          for (const [key, value] of formData) {
            if (String(value)) query.set(key, String(value));
          }

          setFilter("?" + query);
        }}
      >
        <Field label="Categoría">
          <select name="category">
            <option value="">Todas</option>
            {cats.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Modalidad">
          <select name="modality">
            <option value="">Todas</option>
            {["virtual", "tutor_home", "student_home"].map((modality) => (
              <option key={modality} value={modality}>
                {labels[modality]}
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
          <input name="radius" type="number" min="0.1" step="0.1" />
        </Field>

        <Field label="Estrellas mínimas">
          <input name="rating" type="number" min="0" max="5" step="0.1" />
        </Field>

        <Field label="Reseñas mínimas">
          <input name="reviews" type="number" min="0" />
        </Field>

        <button>Buscar</button>
      </form>

      <Status {...offers} />

      {shared && (
        <p>
          Perfil compartido. <a href={location.pathname}>Ver todos los tutores</a>
        </p>
      )}

      <div className="grid cards">
        {displayed?.map((offer) => (
          <article className="panel" key={offer.id}>
            <span className="pill">{offer.category}</span>
            <h2>{offer.title}</h2>

            <div className="identity">
              <img src={offer.picture} alt="" />
              <strong>{offer.name}</strong>
            </div>

            <p>{offer.description}</p>
            <p>
              ★ {Number(offer.rating).toFixed(1)} · {offer.review_count} reseñas
            </p>
            <p>{offer.distance_km.toFixed(1)} km de cercanía</p>
            <p>{offer.modalities.map((modality) => labels[modality]).join(" · ")}</p>

            <div className="card-bottom">
              <strong>{money(offer.hourly_rate)} / hora</strong>
              <button onClick={() => setSelected(offer)}>Ver tutoría</button>
            </div>
          </article>
        ))}
      </div>

      {displayed?.length === 0 && (
        <p>
          No hay ofertas que coincidan. Los tutores deben estar aprobados y
          publicar una oferta.
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
  offer,
  close,
  openChat,
}: {
  offer: Offer;
  close: () => void;
  openChat: (id: string) => void;
}) {
  const { state } = useAuth();
  const action = useAction();

  const reviews = useData<Review[]>(`/tutors/${offer.tutor_id}/reviews`);
  const availability = useData<Block[]>(`/availability/${offer.tutor_id}`);

  const share = encodeURIComponent(
    `${offer.name}: ${offer.title}. Desde ${money(offer.hourly_rate)}/hora. ${location.origin}/?tutor=${offer.tutor_id}`,
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

        <h1>{offer.title}</h1>
        <h2>{offer.name}</h2>
        <p>{offer.bio}</p>
        <p>{offer.description}</p>

        <a
          className="button secondary"
          href={`https://wa.me/?text=${share}`}
          target="_blank"
          rel="noreferrer"
        >
          Compartir por WhatsApp
        </a>

        <Notice {...action} />

        <h3>Disponibilidad semanal · Guatemala</h3>
        <Status {...availability} />

        {availability.data?.map((block, index) => (
          <p key={index}>
            {days[block.weekday]}: {clock(block.start_min)}–
            {clock(block.end_min)}
          </p>
        ))}

        {state.user?.role === "student" && (
          <>
            <button
              onClick={() =>
                void action.run(async () => {
                  const conversation = await api<Conversation>(
                    "/conversations",
                    "POST",
                    { tutor_id: offer.tutor_id },
                  );

                  openChat(conversation.id);
                  close();
                }, "Conversación abierta")
              }
            >
              Conversar con tutor
            </button>

            <BookingForm offer={offer} />
          </>
        )}

        <h3>Reseñas del tutor</h3>
        <Status {...reviews} />

        {reviews.data?.length === 0 && <p>Todavía no tiene reseñas.</p>}

        {reviews.data?.map((review, index) => (
          <article className="review" key={index}>
            <strong>
              {review.name} · {"★".repeat(review.stars)}
            </strong>
            <p>{review.comment}</p>
            <small>{date(review.created_at)}</small>
          </article>
        ))}
      </section>
    </div>
  );
}

export function clock(minutes: number) {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}