const DEFAULT_ENGINE_API_BASE_URL = "http://127.0.0.1:8000";

export function getEngineApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_ENGINE_API_BASE_URL;
}

export async function fetchEngineJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; payload: T }> {
  const baseUrl = getEngineApiBaseUrl();
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });

  const payload = (await response.json()) as T;
  return { response, payload };
}
