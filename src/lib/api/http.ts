import { supabase } from "@/integrations/supabase/client";

const API_BASE_URL = "http://localhost:4000";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;

  const headers = new Headers(init?.headers ?? {});
  headers.set("Accept", "application/json");

  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload ? (payload as any).error : "Request failed";
    const err = new Error(message);
    (err as any).status = res.status;
    (err as any).payload = payload;
    throw err;
  }

  return payload as T;
}