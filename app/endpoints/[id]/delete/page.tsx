"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { deleteEndpoint } from "@/app/lib/api";

export default function DeleteEndpointPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const { token, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !token) router.replace("/login");
  }, [token, authLoading, router]);

  async function handleDelete() {
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteEndpoint(id, token);
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-lg">
        <header className="mb-6">
          <Link href={`/endpoints/${id}`} className="text-blue-600 hover:underline">
            ← Back to endpoint
          </Link>
        </header>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <h1 className="text-xl font-bold text-gray-900">Delete endpoint?</h1>
          <p className="mt-2 text-gray-600">
            This will remove the endpoint and all its check history. This cannot be undone.
          </p>
          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Deleting…" : "Delete"}
            </button>
            <Link
              href={`/endpoints/${id}`}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
