import { env } from "../config/env";

function withQuery(path: string, query?: Record<string, any>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  }

  const queryStr = params.toString();
  const sep = path.includes("?") ? "&" : "?";
  return `${env.apiBaseUrl}${path}${queryStr ? `${sep}${queryStr}` : ""}`;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("ghl_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class HttpClient {
  private async readError(response: Response): Promise<never> {
    const contentType = response.headers.get("content-type") || "";
    let message = `Request failed with status ${response.status}`;

    try {
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as { message?: string };
        if (typeof payload.message === "string" && payload.message.length > 0) {
          message = payload.message;
        }
      } else {
        const text = await response.text();
        if (text) {
          message = text;
        }
      }
    } catch {
      // Keep the default fallback message if parsing fails.
    }

    throw new Error(message);
  }

  async get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    const response = await fetch(withQuery(path, query), { headers: authHeaders() });

    if (!response.ok) {
      return this.readError(response);
    }

    return (await response.json()) as T;
  }

  async post<TRequest, TResponse>(
    path: string,
    payload: TRequest,
    query?: Record<string, string | undefined>
  ): Promise<TResponse> {
    const response = await fetch(withQuery(path, query), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return this.readError(response);
    }

    return (await response.json()) as TResponse;
  }
}

export const httpClient = new HttpClient();
