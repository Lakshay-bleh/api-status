"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, getStoredToken } from "@/app/contexts/AuthContext";
import {
  fetchEndpoints,
  fetchDashboardStats,
  type EndpointItem,
  type DashboardStats,
} from "@/app/lib/api";

function StatusBadge({ success }: { success: boolean | null }) {
  if (success === null) return <span className="text-gray-500">—</span>;
  return success ? (
    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      Up
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
      Down
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type StatusFilter = "all" | "up" | "down";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user, loading: authLoading, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s === "up" || s === "down" || s === "all") setStatusFilter(s);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedToken = getStoredToken();
    if (!authLoading && !token && !storedToken) {
      router.replace("/login");
      return;
    }
    const effectiveToken = token ?? storedToken;
    if (!effectiveToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchDashboardStats(effectiveToken),
      fetchEndpoints(effectiveToken, statusFilter === "all" ? undefined : statusFilter),
    ])
      .then(([s, e]) => {
        if (!cancelled) {
          setStats(s);
          setEndpoints(e);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          if (e instanceof Error && e.message === "Unauthorized") {
            logout();
            router.replace("/login");
          } else {
            setError(e instanceof Error ? e.message : "Failed to load");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, authLoading, statusFilter, router, logout]);

  const hasStoredToken = typeof window !== "undefined" && !!getStoredToken();
  const showLoading = authLoading || ((!token && !hasStoredToken) && !error);

  if (showLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">API Status Dashboard</h1>
            <span className="text-sm text-gray-500">{user?.username}</span>
          </div>
          <div className="flex gap-2">
            <Link
              href="/analytics"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Analytics
            </Link>
            <Link
              href="/endpoints/new"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add endpoint
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
        )}

        {!error && stats && (
          <>
            <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
                <p className="text-sm font-medium text-gray-500">Total endpoints</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total_endpoints}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
                <p className="text-sm font-medium text-gray-500">Up</p>
                <p className="mt-1 text-2xl font-bold text-green-700">{stats.up_count}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
                <p className="text-sm font-medium text-gray-500">Down</p>
                <p className="mt-1 text-2xl font-bold text-red-700">{stats.down_count}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
                <p className="text-sm font-medium text-gray-500">Uptime (24h)</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {stats.uptime_pct_24h != null ? `${stats.uptime_pct_24h}%` : "—"}
                </p>
              </div>
            </section>

            {stats.recent_checks.length > 0 && (
              <section className="mb-8 rounded-lg border border-gray-200 bg-white shadow">
                <h2 className="border-b border-gray-200 p-4 text-lg font-semibold text-gray-900">
                  Recent activity
                </h2>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Endpoint
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Time
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Response
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {stats.recent_checks.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-3 text-sm font-medium text-gray-900">
                          <Link
                            href={`/endpoints/${c.endpoint_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {c.endpoint_name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3">
                          <StatusBadge success={c.success} />
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-500">
                          {formatDate(c.checked_at)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-500">
                          {c.response_time_ms != null ? `${c.response_time_ms} ms` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}

        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Endpoints</h2>
            <div className="flex gap-2">
              {(["all", "up", "down"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    statusFilter === s
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {s === "all" ? "All" : s === "up" ? "Up" : "Down"}
                </button>
              ))}
            </div>
          </div>

          {loading && endpoints.length === 0 && (
            <p className="py-4 text-gray-500">Loading endpoints...</p>
          )}

          {!loading && endpoints.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
              No endpoints yet.{" "}
              <Link href="/endpoints/new" className="text-blue-600 hover:underline">
                Add your first endpoint
              </Link>
              .
            </div>
          )}

          {endpoints.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Last checked
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Response time
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {endpoints.map((ep) => (
                    <tr key={ep.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                        <Link
                          href={`/endpoints/${ep.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {ep.name}
                        </Link>
                      </td>
                      <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-500">
                        {ep.url}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <StatusBadge success={ep.latest_check?.success ?? null} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {ep.latest_check?.checked_at
                          ? formatDate(ep.latest_check.checked_at)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {ep.latest_check?.response_time_ms != null
                          ? `${ep.latest_check.response_time_ms} ms`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <Link
                          href={`/endpoints/${ep.id}/edit`}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
