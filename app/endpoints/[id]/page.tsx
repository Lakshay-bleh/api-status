"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  fetchEndpoint,
  fetchEndpointChecks,
  runCheckNow,
  type EndpointItem,
  type CheckResultItem,
} from "@/app/lib/api";

function StatusBadge({ success }: { success: boolean }) {
  return success ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      Up
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
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

type SinceFilter = "all" | "24h" | "7d";

function sinceToIso(since: SinceFilter): string | undefined {
  if (since === "all") return undefined;
  const d = new Date();
  if (since === "24h") d.setHours(d.getHours() - 24);
  else if (since === "7d") d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export default function EndpointDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const { token, loading: authLoading, logout } = useAuth();
  const [endpoint, setEndpoint] = useState<EndpointItem | null>(null);
  const [checks, setChecks] = useState<CheckResultItem[]>([]);
  const [sinceFilter, setSinceFilter] = useState<SinceFilter>("all");
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/login");
      return;
    }
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchEndpoint(id, token),
      fetchEndpointChecks(id, token, { limit: 100, since: sinceToIso(sinceFilter) }),
    ])
      .then(([ep, ch]) => {
        if (!cancelled) {
          setEndpoint(ep);
          setChecks(ch);
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
  }, [id, token, authLoading, sinceFilter, router, logout]);

  async function handleRunCheckNow() {
    if (!token) return;
    setChecking(true);
    setError(null);
    try {
      await runCheckNow(id, token);
      const [ep, ch] = await Promise.all([
        fetchEndpoint(id, token),
        fetchEndpointChecks(id, token, { limit: 100, since: sinceToIso(sinceFilter) }),
      ]);
      setEndpoint(ep);
      setChecks(ch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run check");
    } finally {
      setChecking(false);
    }
  }

  if (authLoading || (loading && !endpoint)) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  if (error && !endpoint) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>
          <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!endpoint) return null;

  const latest = endpoint.latest_check;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{endpoint.name}</h1>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRunCheckNow}
                disabled={checking}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {checking ? "Checking..." : "Run check now"}
              </button>
              <Link
                href={`/endpoints/${id}/edit`}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Edit
              </Link>
              <Link
                href={`/endpoints/${id}/delete`}
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Delete
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">URL</dt>
              <dd className="mt-1 break-all text-sm text-gray-900">{endpoint.url}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Check interval</dt>
              <dd className="mt-1 text-sm text-gray-900">{endpoint.interval_minutes} min</dd>
            </div>
            {latest && (
              <>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current status</dt>
                  <dd className="mt-1">
                    <StatusBadge success={latest.success} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last checked</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(latest.checked_at)}</dd>
                </div>
                {latest.response_time_ms != null && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Response time</dt>
                    <dd className="mt-1 text-sm text-gray-900">{latest.response_time_ms} ms</dd>
                  </div>
                )}
                {!latest.success && latest.error_message && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Error</dt>
                    <dd className="mt-1 text-sm text-red-600">{latest.error_message}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Check history</h2>
          <div className="flex gap-2">
            {(["all", "24h", "7d"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSinceFilter(s)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  sinceFilter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : s === "24h" ? "Last 24h" : "Last 7 days"}
              </button>
            ))}
          </div>
        </div>

        {checks.length === 0 ? (
          <p className="text-gray-500">No checks recorded yet. Use Run check now or wait for the cron.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Response time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {checks.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {formatDate(c.checked_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge success={c.success} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {c.status_code ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {c.response_time_ms != null ? `${c.response_time_ms} ms` : "-"}
                    </td>
                    <td className="max-w-xs truncate px-6 py-4 text-sm text-red-600">
                      {c.error_message || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
