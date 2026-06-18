// ────────────────────────────────────────────────────
//  Centralized API client
// ────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getApiUrl(): string {
  return API_BASE;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });



  if (!res.ok) {
    const text = await res.text().catch(() => "Request failed");
    let message = `API error ${res.status}`;
    try {
      const obj = JSON.parse(text);
      message = obj.detail || obj.message || message;
    } catch {
      message = text || message;
    }
    throw new Error(message);
  }

  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Intelligence Layer API Helpers ──

export async function fetchLinkedInIntelligence(candidateId: number): Promise<any> {
  return apiFetch<any>(`/api/intelligence/${candidateId}/linkedin`);
}

export async function fetchBenchmarkData(candidateId: number, jobId: number): Promise<any> {
  return apiFetch<any>(`/api/intelligence/${candidateId}/benchmark?job_id=${jobId}`);
}

export async function fetchRankingAudit(candidateId: number, jobId: number): Promise<any> {
  return apiFetch<any>(`/api/intelligence/${candidateId}/audit?job_id=${jobId}`);
}

export async function postTalentRediscovery(jobDescription: string, limit: number = 10): Promise<any> {
  return apiPost<any>(`/api/intelligence/talent-rediscovery`, { job_description: jobDescription, limit });
}

