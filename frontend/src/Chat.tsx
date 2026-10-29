import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  api,
  BASE,
  deleteChatAttachment,
  downloadChatAttachment,
  uploadChatAttachment,
} from "./api";
import { useAuth } from "./auth";
import { Notice, Status, useData, date } from "./ui";
import type { ChatAttachment, Conversation, Message } from "./types";
export default function Chat({ initial }: { initial: string }) {
  const { state, refresh } = useAuth(),
    q = useData<Conversation[]>("/conversations");
  const [selected, setSelected] = useState(initial),
    [messages, setMessages] = useState<Message[]>([]),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [text, setText] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false);
  const socket = useRef<Socket | null>(null),
    selectedRef = useRef(selected),
    fileInput = useRef<HTMLInputElement | null>(null);
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
                    {m.body && <p>{m.body}</p>}
                    {m.attachments?.map((attachment) => (
                      <MessageAttachment
                        key={attachment.id}
                        conversationId={m.conversation_id}
                        attachment={attachment}
                      />
                    ))}
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
                  if (!text.trim() && files.length === 0) return;
                  setBusy(true);
                  void (async () => {
                    const uploaded: ChatAttachment[] = [];
                    try {
                      for (const file of files) {
                        uploaded.push(
                          await uploadChatAttachment(selected, file),
                        );
                      }
                      if (!socket.current) throw Error("Chat desconectado");
                      socket.current.timeout(15000).emit(
                        "chat:send",
                        {
                          conversation_id: selected,
                          body: text.trim(),
                          attachment_ids: uploaded.map((item) => item.id),
                        },
                        (
                          err: Error | null,
                          result: { ok: boolean; message?: string },
                        ) => {
                          setBusy(false);
                          if (err || !result?.ok) {
                            setError(
                              result?.message ||
                                "No se confirmó el envío. Revisa el historial antes de reenviar.",
                            );
                            void Promise.all(
                              uploaded.map((item) =>
                                deleteChatAttachment(selected, item.id).catch(
                                  () => undefined,
                                ),
                              ),
                            );
                            return;
                          }
                          setText("");
                          setFiles([]);
                          setError("");
                          if (fileInput.current) fileInput.current.value = "";
                        },
                      );
                    } catch (error) {
                      await Promise.all(
                        uploaded.map((item) =>
                          deleteChatAttachment(selected, item.id).catch(
                            () => undefined,
                          ),
                        ),
                      );
                      setBusy(false);
                      setError((error as Error).message);
                    }
                  })();
                }}
              >
                <label className="field">
                  <span>Mensaje</span>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={2000}
                  />
                </label>
                <label className="field">
                  <span>Adjuntar PDF o imágenes (máximo 5 archivos de 5 MB)</span>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    multiple
                    disabled={busy}
                    onChange={(e) => {
                      const incoming = Array.from(e.target.files || []);
                      const combined = [...files, ...incoming];
                      const allowed = new Set([
                        "application/pdf",
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                      ]);
                      if (combined.length > 5) {
                        setError("Puedes adjuntar como máximo 5 archivos.");
                        e.target.value = "";
                        return;
                      }
                      const invalid = combined.find(
                        (file) =>
                          !allowed.has(file.type) ||
                          file.size > 5 * 1024 * 1024,
                      );
                      if (invalid) {
                        setError(
                          "Cada adjunto debe ser PDF, JPG, PNG o WEBP y pesar hasta 5 MB.",
                        );
                        e.target.value = "";
                        return;
                      }
                      setError("");
                      setFiles(combined);
                      e.target.value = "";
                    }}
                  />
                </label>
                {files.length > 0 && (
                  <ul>
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            setFiles((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  disabled={
                    !connected || busy || (!text.trim() && files.length === 0)
                  }
                >
                  Enviar
                </button>
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

function MessageAttachment({
  conversationId,
  attachment,
}: {
  conversationId: string;
  attachment: ChatAttachment;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void downloadChatAttachment(conversationId, attachment.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, attachment.id]);

  if (error) return <p>{attachment.file_name}: {error}</p>;
  if (!url) return <p role="status">Cargando {attachment.file_name}…</p>;

  return (
    <div className="chat-attachment">
      {attachment.mime_type.startsWith("image/") && (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={attachment.file_name} />
        </a>
      )}
      <a href={url} download={attachment.file_name}>
        {attachment.file_name} ·{" "}
        {(attachment.size_bytes / (1024 * 1024)).toFixed(2)} MB
      </a>
    </div>
  );
}