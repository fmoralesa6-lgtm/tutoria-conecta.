import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, BASE } from "./api";
import { useAuth } from "./auth";
import { Notice, Status, useData, date } from "./ui";
import type { Conversation, Message } from "./types";
export default function Chat({ initial }: { initial: string }) {
  const { state, refresh } = useAuth(),
    q = useData<Conversation[]>("/conversations");
  const [selected, setSelected] = useState(initial),
    [messages, setMessages] = useState<Message[]>([]),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  const socket = useRef<Socket | null>(null),
    selectedRef = useRef(selected);
  selectedRef.current = selected;
  const read = (id: string) => {
    if (document.visibilityState === "visible")
      socket.current?.emit("chat:read", { conversation_id: id });
  };
  useEffect(() => {
    const s = io(BASE.replace(/\/api$/, ""), {
      auth: { token: sessionStorage.getItem("token") },
    });
    socket.current = s;
    s.on("connect", () => {
      setConnected(true);
      setError("");
      if (selectedRef.current) {
        void api<Message[]>(
          "/conversations/" + selectedRef.current + "/messages",
        )
          .then(setMessages)
          .catch((e) => setError(e.message));
        read(selectedRef.current);
      }
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => {
      setError("Chat desconectado. Revisa tu sesión o espera la reconexión.");
      void refresh();
    });
    s.on("account:changed", () => void refresh());
    s.on("chat:message", (m: Message) => {
      if (m.conversation_id === selectedRef.current) {
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m],
        );
        read(m.conversation_id);
      }
      void q.reload();
    });
    s.on(
      "chat:read",
      (p: {
        conversation_id: string;
        rows: { id: string; read_at: string }[];
      }) => {
        if (p.conversation_id === selectedRef.current)
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              read_at: p.rows.find((x) => x.id === m.id)?.read_at || m.read_at,
            })),
          );
      },
    );
    const visible = () => {
      if (selectedRef.current) read(selectedRef.current);
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      s.disconnect();
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setMessages([]);
    setError("");
    if (selected)
      void api<Message[]>("/conversations/" + selected + "/messages")
        .then((m) => {
          if (alive) {
            setMessages(m);
            read(selected);
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [selected]);
  return (
    <>
      <h1>Mensajes</h1>
      <p>{connected ? "Conectado en tiempo real" : "Conectando…"}</p>
      <Notice error={error} />
      <Status {...q} />
      <div className="chat-layout">
        <aside className="panel">
          {q.data?.map((c) => (
            <button
              className={selected === c.id ? "" : "secondary"}
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              {state.user?.role === "student" ? c.tutor_name : c.student_name}
            </button>
          ))}
          {q.data?.length === 0 && (
            <p>Inicia una conversación desde el catálogo.</p>
          )}
        </aside>
        <section className="panel">
          {selected ? (
            <>
              <div className="messages" aria-live="polite">
                {messages.map((m) => (
                  <article
                    className={
                      "bubble " + (m.sender_id === state.user?.id ? "mine" : "")
                    }
                    key={m.id}
                  >
                    <p>{m.body}</p>
                    <small>
                      {date(m.created_at)}{" "}
                      {m.sender_id === state.user?.id &&
                        (m.read_at ? "· Leído" : "· Enviado")}
                    </small>
                  </article>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setBusy(true);
                  socket.current
                    ?.timeout(10000)
                    .emit(
                      "chat:send",
                      { conversation_id: selected, body: text },
                      (
                        err: Error | null,
                        r: { ok: boolean; message?: string },
                      ) => {
                        setBusy(false);
                        if (err || !r?.ok)
                          setError(
                            r?.message ||
                              "No se confirmó el envío. Revisa el historial antes de reenviar.",
                          );
                        else setText("");
                      },
                    );
                }}
              >
                <label className="field">
                  <span>Mensaje</span>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    maxLength={2000}
                  />
                </label>
                <button disabled={!connected || busy}>Enviar</button>
              </form>
            </>
          ) : (
            <p>Selecciona una conversación.</p>
          )}
        </section>
      </div>
    </>
  );
}
