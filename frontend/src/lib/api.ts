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
    // 1. Primary API URL
    if (API_BASE) {
      candidateUrls.push(normalizeUrl(API_BASE, endpoint));
    }
    // 2. Backup API URL for failover
    if (BACKUP_API_BASE && BACKUP_API_BASE !== API_BASE) {
      const backupUrl = normalizeUrl(BACKUP_API_BASE, endpoint);
      if (!candidateUrls.includes(backupUrl)) {
        candidateUrls.push(backupUrl);
      }
    }
    // 3. Fallback to local Next.js proxy rewrite if relative path
    const relativePath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (!candidateUrls.includes(relativePath)) {
      candidateUrls.push(relativePath);
    }
  }

  let lastError: unknown = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        ...restOptions,
        headers,
      });

      if (!res.ok) {
        let errorDetail = `Request failed with status ${res.status}`;
        try {
          const errJson = await res.json();
          errorDetail = errJson.detail || errJson.message || errorDetail;
        } catch {
          // response wasn't JSON
        }

        // On client-side errors (400, 401, 403, 422, etc.), do not failover to backup
        if (res.status >= 400 && res.status < 500 && res.status !== 404 && res.status !== 408) {
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

