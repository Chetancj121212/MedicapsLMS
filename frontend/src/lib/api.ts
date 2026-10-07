import { environment } from "@/config/environment";

export const API_BASE = environment.apiUrl;
export const BACKUP_API_BASE = environment.backupApiUrl;

export function getCertificateDownloadUrl(certificateNumber: string): string {
  return `${API_BASE}/api/certificates/${certificateNumber}/download`;
}

interface FetchOptions extends RequestInit {
  token?: string;
}

class ClientHttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ClientHttpError";
  }
}

function normalizeUrl(base: string, endpoint: string): string {
  const cleanBase = base.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

export async function fetchApi<T = unknown>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token, headers: customHeaders, ...restOptions } = options;

  let authToken = token;
  if (!authToken && typeof window !== "undefined") {
    authToken = localStorage.getItem("auth_token") || undefined;
  }

  const headers: Record<string, string> = {
    ...((customHeaders as Record<string, string>) || {}),
  };

  // Only set Content-Type if body is not FormData
  if (!(restOptions.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const candidateUrls: string[] = [];
  if (endpoint.startsWith("http")) {
    candidateUrls.push(endpoint);
  } else {
    const urls: string[] = [];
    if (API_BASE) urls.push(normalizeUrl(API_BASE, endpoint));
    if (BACKUP_API_BASE && BACKUP_API_BASE !== API_BASE) {
      urls.push(normalizeUrl(BACKUP_API_BASE, endpoint));
    }
    const relativePath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (!urls.includes(relativePath)) urls.push(relativePath);

    for (const u of urls) {
      if (!candidateUrls.includes(u)) {
        candidateUrls.push(u);
      }
    }
  }

  let lastError: unknown = null;

  for (const url of candidateUrls) {
    try {
      let signal = restOptions.signal;
      if (!signal && typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
        signal = AbortSignal.timeout(5000);
      }

      const res = await fetch(url, {
        ...restOptions,
        signal,
        headers,
      });

      if (!res.ok) {
        let isJson = false;
        let errorDetail = `Request failed with status ${res.status}`;
        try {
          const errJson = await res.json();
          errorDetail = errJson.detail || errJson.message || errorDetail;
          isJson = true;
        } catch {
          // response wasn't JSON (e.g. Cloudflare HTML 403/502/504)
        }

        // On genuine API client errors with JSON responses (400, 401, 422), do not failover
        if (
          isJson &&
          res.status >= 400 &&
          res.status < 500 &&
          res.status !== 404 &&
          res.status !== 408
        ) {
          throw new ClientHttpError(errorDetail, res.status);
        }

        throw new Error(errorDetail);
      }

      if (res.status === 204) {
        return {} as T;
      }

      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof ClientHttpError) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

