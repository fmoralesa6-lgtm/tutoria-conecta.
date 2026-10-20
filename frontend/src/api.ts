export const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:4000/api"
).replace(/\/$/, "");
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token =
    path === "/auth/google"
      ? (body as { credential: string }).credential
      : sessionStorage.getItem("token");
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    throw Error(
      "No se pudo conectar. Revisa tu conexión y el estado del servidor.",
    );
  }
  const data = res.status === 204 ? null : await res.json();
  if (res.status === 401) {
    sessionStorage.removeItem("token");
    window.dispatchEvent(new Event("logout"));
  }
  if (
    data?.message === "ACCOUNT_SUSPENDED" ||
    data?.message === "ONBOARDING_REQUIRED"
  )
    window.dispatchEvent(new Event("refresh-user"));
  if (!res.ok) throw Error(data?.message || "Error en la solicitud");
  return data as T;
}
