const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";
export const AUTH_UNAUTHORIZED_EVENT = "cakir-auth-unauthorized";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const method = (init?.method ?? "GET").toUpperCase();
  const changesState = !["GET", "HEAD", "OPTIONS"].includes(method);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(changesState ? { "X-App-Request": "cakir-panel" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }

  return response;
};

export const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await apiFetch(path, init);
  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data && typeof data === "object" && "message" in data && data.message
        ? data.message
        : "İstek tamamlanamadı",
    );
  }

  return data as T;
};
