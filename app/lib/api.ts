function getApiBase(): string {
  if (process.env.NODE_ENV === "development")
    return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
  let base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base && typeof window === "undefined" && process.env.VERCEL_URL)
    base = `https://${process.env.VERCEL_URL}`;
  if (!base) return "";
  // Avoid mixed-content: force https for non-localhost so HTTPS pages can call the API
  if (base.startsWith("http://") && !base.includes("localhost") && !base.includes("127.0.0.1"))
    base = "https://" + base.slice(7);
  return base;
}
const API_BASE = getApiBase();

export function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export type EndpointItem = {
  id: number;
  name: string;
  url: string;
  interval_minutes: number;
  created_at: string;
  updated_at: string;
  latest_check: {
    id: number;
    status_code: number | null;
    response_time_ms: number | null;
    success: boolean;
    checked_at: string;
    error_message: string;
  } | null;
};

export type CheckResultItem = {
  id: number;
  status_code: number | null;
  response_time_ms: number | null;
  success: boolean;
  checked_at: string;
  error_message: string;
};

export type DashboardStats = {
  total_endpoints: number;
  up_count: number;
  down_count: number;
  uptime_pct_24h: number | null;
  recent_checks: Array<{
    id: number;
    endpoint_id: number;
    endpoint_name: string;
    success: boolean;
    status_code: number | null;
    response_time_ms: number | null;
    checked_at: string;
    error_message: string;
  }>;
};

export type AnalyticsSeriesItem = {
  period: string;
  total_checks: number;
  failure_count: number;
  uptime_pct: number;
  avg_response_time_ms: number;
};

export type AnalyticsResponse = {
  series: AnalyticsSeriesItem[];
  summary: { uptime_pct: number; avg_response_time_ms: number; total_checks: number };
};

export async function login(
  username: string,
  password: string
): Promise<{ user: { id: number; username: string; email: string }; access: string; refresh: string }> {
  const res = await fetch(apiUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Login failed");
  }
  return res.json();
}

export async function register(
  username: string,
  password: string,
  email?: string
): Promise<{ user: { id: number; username: string; email: string }; access: string; refresh: string }> {
  const res = await fetch(apiUrl("/api/v1/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email: email || "" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Registration failed");
  }
  return res.json();
}

export async function fetchMe(token: string): Promise<{ id: number; username: string; email: string }> {
  const res = await fetch(apiUrl("/api/v1/auth/me"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}

export async function fetchEndpoints(token: string | null, statusFilter?: "up" | "down"): Promise<EndpointItem[]> {
  let url = apiUrl("/api/v1/endpoints/");
  if (statusFilter) url += `?status=${statusFilter}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to fetch endpoints");
  return res.json();
}

export async function fetchEndpoint(id: string, token: string | null): Promise<EndpointItem> {
  const res = await fetch(apiUrl(`/api/v1/endpoints/${id}/`), { headers: authHeaders(token) });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to fetch endpoint");
  return res.json();
}

export async function fetchEndpointChecks(
  id: string,
  token: string | null,
  opts?: { limit?: number; since?: string }
): Promise<CheckResultItem[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.since) params.set("since", opts.since);
  const qs = params.toString();
  const path = `/api/v1/endpoints/${id}/checks/${qs ? `?${qs}` : ""}`;
  const url = apiUrl(path);
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to fetch checks");
  return res.json();
}

export async function fetchDashboardStats(token: string | null, endpointId?: string): Promise<DashboardStats> {
  let url = apiUrl("/api/v1/dashboard/stats/");
  if (endpointId) url += `?endpoint_id=${endpointId}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

export async function fetchAnalytics(
  token: string | null,
  opts?: { endpoint_id?: string; since?: string; until?: string; group_by?: "day" | "hour" }
): Promise<AnalyticsResponse> {
  const params = new URLSearchParams();
  if (opts?.endpoint_id) params.set("endpoint_id", opts.endpoint_id);
  if (opts?.since) params.set("since", opts.since);
  if (opts?.until) params.set("until", opts.until);
  if (opts?.group_by) params.set("group_by", opts.group_by);
  const qs = params.toString();
  const url = apiUrl(qs ? `/api/v1/analytics/?${qs}` : "/api/v1/analytics/");
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function createEndpoint(
  token: string | null,
  body: { name: string; url: string; interval_minutes?: number }
): Promise<EndpointItem> {
  const res = await fetch(apiUrl("/api/v1/endpoints/"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to create");
  }
  return res.json();
}

export async function updateEndpoint(
  id: string,
  token: string | null,
  body: { name?: string; url?: string; interval_minutes?: number }
): Promise<EndpointItem> {
  const res = await fetch(apiUrl(`/api/v1/endpoints/${id}/`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to update");
  }
  return res.json();
}

export async function deleteEndpoint(id: string, token: string | null): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/endpoints/${id}/`), {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to delete");
}

export async function runCheckNow(id: string, token: string | null): Promise<CheckResultItem> {
  const res = await fetch(apiUrl(`/api/v1/endpoints/${id}/check-now/`), {
    method: "POST",
    headers: authHeaders(token),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to run check");
  return res.json();
}
