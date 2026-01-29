"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { fetchAnalytics, fetchEndpoints, type AnalyticsResponse, type EndpointItem } from "@/app/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

function toISO(date: Date): string {
  return date.toISOString().slice(0, 19) + "Z";
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { token, loading: authLoading, logout } = useAuth();
  const [endpoints, setEndpoints] = useState<EndpointItem[]>([]);
  const [endpointId, setEndpointId] = useState<string>("");
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [groupBy, setGroupBy] = useState<"day" | "hour">("day");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/login");
      return;
    }
    if (!token) return;
    let cancelled = false;
    fetchEndpoints(token)
      .then((e) => {
        if (!cancelled) setEndpoints(e);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    const until = new Date();
    const since = new Date();
    if (range === "7d") since.setDate(since.getDate() - 7);
    else since.setDate(since.getDate() - 30);
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAnalytics(token, {
      endpoint_id: endpointId || undefined,
      since: toISO(since),
      until: toISO(until),
      group_by: groupBy,
    })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) {
          if (e instanceof Error && e.message === "Unauthorized") {
            logout();
            router.replace("/login");
          } else {
            setError(e instanceof Error ? e.message : "Failed to load analytics");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, endpointId, range, groupBy, router, logout]);

  if (authLoading || (!token && !error)) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  const series = data?.series ?? [];
  const summary = data?.summary;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
        )}

        <section className="mb-8 flex flex-wrap gap-4">
          <div>
            <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700 mb-1">
              Endpoint
            </label>
            <select
              id="endpoint"
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              {endpoints.map((ep) => (
                <option key={ep.id} value={String(ep.id)}>
                  {ep.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="range" className="block text-sm font-medium text-gray-700 mb-1">
              Range
            </label>
            <select
              id="range"
              value={range}
              onChange={(e) => setRange(e.target.value as "7d" | "30d")}
              className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="groupBy" className="block text-sm font-medium text-gray-700 mb-1">
              Group by
            </label>
            <select
              id="groupBy"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as "day" | "hour")}
              className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="day">Day</option>
              <option value="hour">Hour</option>
            </select>
          </div>
        </section>

        {summary && (
          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
              <p className="text-sm font-medium text-gray-500">Uptime %</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{summary.uptime_pct}%</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
              <p className="text-sm font-medium text-gray-500">Avg response time</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{summary.avg_response_time_ms} ms</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
              <p className="text-sm font-medium text-gray-500">Total checks</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{summary.total_checks}</p>
            </div>
          </section>
        )}

        {loading && !data && <p className="text-gray-500 py-4">Loading analytics...</p>}

        {!loading && data && (
          <>
            <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Uptime % over time</h2>
              {series.length === 0 ? (
                <p className="text-gray-500">No data for the selected range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).slice(0, 10)} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, "Uptime"]} labelFormatter={(v) => String(v)} />
                    <Line type="monotone" dataKey="uptime_pct" stroke="#2563eb" strokeWidth={2} dot={false} name="Uptime %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Avg response time (ms)</h2>
              {series.length === 0 ? (
                <p className="text-gray-500">No data for the selected range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).slice(0, 10)} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v} ms`, "Response time"]} labelFormatter={(v) => String(v)} />
                    <Line type="monotone" dataKey="avg_response_time_ms" stroke="#059669" strokeWidth={2} dot={false} name="Response time (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Failures per period</h2>
              {series.length === 0 ? (
                <p className="text-gray-500">No data for the selected range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).slice(0, 10)} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [v, "Failures"]} labelFormatter={(v) => String(v)} />
                    <Bar dataKey="failure_count" fill="#dc2626" name="Failures" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
