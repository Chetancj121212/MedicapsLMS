import { environment } from "@/config/environment";

export const API_BASE = environment.apiUrl;

export function getCertificateDownloadUrl(certificateNumber: string): string {
  return `${API_BASE}/api/certificates/${certificateNumber}/download`;
}

interface FetchOptions extends RequestInit {
  token?: string;
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

  const candidateUrls = new Set<string>();
  if (endpoint.startsWith("http")) {
    candidateUrls.add(endpoint);
  } else if (endpoint.startsWith("/")) {
    candidateUrls.add(endpoint);
    candidateUrls.add(`${API_BASE}${endpoint}`);
  } else {
    candidateUrls.add(`${API_BASE}${endpoint}`);
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
        throw new Error(errorDetail);
      }

      if (res.status === 204) {
        return {} as T;
      }

      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}
