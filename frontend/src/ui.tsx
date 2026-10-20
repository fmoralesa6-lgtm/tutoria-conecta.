import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
export const money = (v: number | string) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(
    Number(v),
  );
export const date = (v: string) =>
  new Date(v).toLocaleString("es-GT", { timeZone: "America/Guatemala" });
export const labels: Record<string, string> = {
  student: "Estudiante",
  tutor: "Tutor",
  admin: "Administrador",
  virtual: "Virtual",
  tutor_home: "Sede del tutor",
  student_home: "A domicilio",
  pending: "Pendiente",
  approved: "Aprobada",
  completed: "Impartida",
  cancelled: "Cancelada",
  open: "Abierta",
  closed: "Cerrada",
  accepted: "Aceptada",
  rejected: "Rechazada",
};
export const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export function useData<T>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(url));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api<T>(url)
      .then((x) => {
        if (alive) setData(x);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [url]);
  return { data, error, loading, reload };
}
export function Notice({
  error = "",
  message = "",
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert" role="status">
          {message}
        </div>
      )}
    </>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Status({
  loading,
  error,
}: {
  loading: boolean;
  error: string;
}) {
  return (
    <>
      {loading && <p role="status">Cargando…</p>}
      <Notice error={error} />
    </>
  );
}
export function useAction() {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (
    fn: () => Promise<void>,
    success = "Guardado correctamente",
  ) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { error, message, busy, run };
}
