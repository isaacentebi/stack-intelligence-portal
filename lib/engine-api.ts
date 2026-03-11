const DEFAULT_ENGINE_API_BASE_URL = "http://127.0.0.1:8000";

export function getEngineApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_ENGINE_API_BASE_URL;
}

function getOperatorEngineToken(): string | null {
  return process.env.ENGINE_OPERATOR_API_TOKEN ?? null;
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
  const operatorToken = getOperatorEngineToken();
  if (operatorToken && path.startsWith("/v1/operator/") && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${operatorToken}`);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });

  const payload = (await response.json()) as T;
  return { response, payload };
}
