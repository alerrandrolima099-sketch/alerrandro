"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function getTokens() {
  if (typeof window === "undefined") return { accessToken: null, refreshToken: null };
  return {
    accessToken: localStorage.getItem("accessToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

async function tryRefresh(): Promise<string | null> {
  const { refreshToken } = getTokens();
  if (!refreshToken) return null;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken as string;
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const { accessToken } = getTokens();

  const doFetch = async (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch(accessToken);

  if (res.status === 401 && accessToken) {
    const newToken = await tryRefresh();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const data = await res.json();
      message = data.message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export { API_URL };
