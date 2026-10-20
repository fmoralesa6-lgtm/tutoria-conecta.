import { useState, lazy, Suspense } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "./api";
import { useAuth } from "./auth";
import { Notice, useAction } from "./ui";
import type { User } from "./types";
import Onboarding from "./Onboarding";
import { Suspended, Profile, ReportForm, Policies } from "./Account";

const Catalog = lazy(() => import("./Catalog"));
const Tutor = lazy(() => import("./Tutor"));
const Agenda = lazy(() => import("./Agenda"));
const Chat = lazy(() => import("./Chat"));
const Admin = lazy(() => import("./Admin"));

export default function App() {
  const { state, login, logout, refresh } = useAuth();
  const a = useAction();
  const [tab, setTab] = useState("catalog");
  const [chat, setChat] = useState("");
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  const u = state.user;

  const roleName = u
    ? {
        student: "Estudiante",
        tutor: "Tutor",
        admin: "Administrador",
      }[u.role]
    : "";

  const navigation = [
    ["catalog", "Explorar"],
    ...(u?.role === "tutor" ? [["tutor", "Mis tutorías"]] : []),
    ...(u?.role !== "admin"
      ? [
          ["agenda", "Agenda"],
          ["chat", "Mensajes"],
          ["report", "Reportar"],
        ]
      : [["admin", "Administración"]]),
    ["profile", "Mi perfil"],
  ];

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);

    try {
      localStorage.setItem("conecta-theme", next);
    } catch {}
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>

      <header className="site-header">
        <a className="brand" href="/" aria-label="Tutoría Conecta, inicio">
          <span className="brand-mark" aria-hidden="true">
            TC
          </span>
          <span className="brand-copy">
            <span className="brand-title">
              Tutoría<span>Conecta</span>
            </span>
            <span className="brand-caption">Aprender nos conecta</span>
          </span>
        </a>

        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"
            }
            title={
              theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"
            }
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>

          {u && (
            <div className="user">
              <div className="user-copy">
                <strong>{u.name}</strong>
                <span>{roleName}</span>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  logout();
                  setTab("catalog");
                  setChat("");
                }}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {u?.onboarding && !u.suspended && (
        <nav className="main-nav" aria-label="Navegación principal">
          <div className="nav-inner">
            {navigation.map(([id, label]) => (
              <button
                type="button"
                className={`nav-link ${tab === id ? "is-active" : ""}`}
                key={id}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main id="main-content" tabIndex={-1}>
        <Notice error={state.error} />

        {state.error && (
          <button type="button" onClick={() => void refresh()}>
            Reintentar conexión
          </button>
        )}

        <Suspense
          fallback={
            <div className="loading-state" role="status">
              <span className="spinner" aria-hidden="true" />
              Cargando módulo…
            </div>
          }
        >
          {state.loading ? (
            <div className="loading-state" role="status">
              <span className="spinner" aria-hidden="true" />
              Cargando sesión…
            </div>
          ) : !u ? (
            <>
              <section className="hero login">
                <div className="login-copy">
                  <p className="eyebrow">TU PRÓXIMO PASO EMPIEZA AQUÍ</p>
                  <h1>
                    Aprende algo nuevo.
                    <br />
                    <span>Conecta con tu futuro.</span>
                  </h1>
                  <p className="hero-description">
                    Encuentra tutores de idiomas, ciencias, tecnología,
                    deportes y posgrado. Elige tu modalidad y organiza tus
                    clases a tu ritmo.
                  </p>

                  <div className="hero-tags" aria-label="Modalidades">
                    <span>Clases virtuales</span>
                    <span>En sede</span>
                    <span>A domicilio</span>
                  </div>

                  <div className="login-access">
                    <Notice {...a} />
                    <GoogleLogin
                      key={theme}
                      theme={theme === "dark" ? "filled_black" : "outline"}
                      shape="pill"
                      size="large"
                      onSuccess={(r) =>
                        void a.run(async () => {
                          if (!r.credential) {
                            throw Error("Google no devolvió credencial");
                          }

                          const result = await api<{
                            token: string;
                            user: User;
                          }>("/auth/google", "POST", {
                            credential: r.credential,
                          });

                          login(result.token, result.user);
                          setTab("catalog");
                          setChat("");
                        }, "Sesión iniciada")
                      }
                      onError={() =>
                        void a.run(async () => {
                          throw Error("No se pudo iniciar sesión con Google");
                        })
                      }
                    />
                    <p className="login-hint">
                      Ingresa con Google para comenzar.
                    </p>
                  </div>
                </div>

                <aside className="welcome-card" aria-label="Cómo funciona">
                  <span className="welcome-symbol" aria-hidden="true">
                    ✦
                  </span>
                  <p className="eyebrow">UN ESPACIO PARA CRECER</p>
                  <h2>Tu siguiente aprendizaje comienza con una conexión.</h2>
                  <ol className="welcome-steps">
                    <li>
                      <span>01</span>
                      <div>
                        <strong>Encuentra tu tutor</strong>
                        <p>Explora temas, modalidades y tarifas.</p>
                      </div>
                    </li>
                    <li>
                      <span>02</span>
                      <div>
                        <strong>Organiza tus clases</strong>
                        <p>Elige horarios que se adapten a ti.</p>
                      </div>
                    </li>
                    <li>
                      <span>03</span>
                      <div>
                        <strong>Aprende y comparte</strong>
                        <p>Conversa con tu tutor y valora tu experiencia.</p>
                      </div>
                    </li>
                  </ol>
                </aside>
              </section>

              <Policies />
            </>
          ) : u.suspended ? (
            <Suspended />
          ) : !u.onboarding ? (
            <Onboarding />
          ) : tab === "tutor" && u.role === "tutor" ? (
            <Tutor />
          ) : tab === "agenda" && u.role !== "admin" ? (
            <Agenda />
          ) : tab === "chat" && u.role !== "admin" ? (
            <Chat initial={chat} />
          ) : tab === "admin" && u.role === "admin" ? (
            <Admin />
          ) : tab === "profile" ? (
            <Profile />
          ) : tab === "report" && u.role !== "admin" ? (
            <ReportForm />
          ) : (
            <Catalog
              openChat={(id) => {
                setChat(id);
                setTab("chat");
              }}
            />
          )}
        </Suspense>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <strong>Tutoría Conecta</strong>
            <p>Aprendizaje con conexión humana.</p>
            <small>Horarios de Guatemala · Presupuestos en quetzales</small>
          </div>
          <div className="footer-author">
            <span>Desarrollo Web · 2026</span>
            <p>Fredy Leonel Morales Albizures</p>
            <small>9490-23-16408</small>
          </div>
        </div>
      </footer>
    </>
  );
}