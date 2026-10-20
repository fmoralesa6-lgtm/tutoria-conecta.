import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./auth";
import App from "./App";
import "./styles.scss";

let theme = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";

try {
  const saved = localStorage.getItem("conecta-theme");
  if (saved === "dark" || saved === "light") theme = saved;
} catch {}

document.documentElement.dataset.theme = theme;

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </GoogleOAuthProvider>,
);