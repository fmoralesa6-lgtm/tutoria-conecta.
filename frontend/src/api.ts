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

function authorizedHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("token");
  return token ? { Authorization: "Bearer " + token } : {};
}

async function fileResponse(path: string, init?: RequestInit) {
  let response: Response;
  const headers = new Headers(authorizedHeaders());
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  try {
    response = await fetch(BASE + path, {
      ...init,
      headers,
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    throw Error("No se pudo conectar con el servidor para procesar el archivo.");
  }

  if (response.status === 401) {
    sessionStorage.removeItem("token");
    window.dispatchEvent(new Event("logout"));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw Error(data?.message || "No se pudo procesar el archivo");
  }
  return response;
}

export async function uploadChatAttachment(
  conversationId: string,
  file: File,
): Promise<{
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}> {
  const response = await fileResponse(
    "/conversations/" + conversationId + "/attachments",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Type": file.type,
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
    },
  );
  return response.json();
}

export async function downloadChatAttachment(
  conversationId: string,
  attachmentId: string,
): Promise<Blob> {
  const response = await fileResponse(
    "/conversations/" + conversationId + "/attachments/" + attachmentId,
  );
  return response.blob();
}

export async function deleteChatAttachment(
  conversationId: string,
  attachmentId: string,
): Promise<void> {
  await fileResponse(
    "/conversations/" + conversationId + "/attachments/" + attachmentId,
    { method: "DELETE" },
  );
}