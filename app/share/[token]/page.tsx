'use client';

// T4.4 (BUILD.md) — read-only, unauthenticated, no app chrome (no
// CommandBar, no dashboard nav — this route sits outside [owner]/[repo]'s
// layout.tsx on purpose). Client component: fetches
// GET /api/shared/[token] (the one public, admin-backed route —
// lib/supabase/admin.ts is never imported here, only fetch()) the same way
// any external, unauthenticated visitor would. Renders exactly what that
// endpoint returns: the pinned ref's file list, metrics, and short-lived
// download links. Nothing about other branches, members, or repo settings
// is ever available to this page because the API never sends it.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SharedFile {
  path: string;
  sha256: string;
  sizeBytes: number | null;
  downloadUrl: string | null;
  metrics: {
    format: string;
    triangleCount: number | null;
    volumeMm3: number | null;
    surfaceAreaMm2: number | null;
    bbox: { min: [number, number, number]; max: [number, number, number] } | null;
    isWatertight: boolean | null;
  } | null;
}

interface SharedPayload {
  ref: string;
  shortSha: string;
  files: SharedFile[];
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shared/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || 'error' in body) {
          setError(body.error?.message ?? 'This share link is invalid or has expired.');
        } else {
          setData(body.data as SharedPayload);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this share link.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Vector Vault · shared read-only view</p>
        {data && (
          <h1 className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">
            {data.ref} <span className="font-mono text-sm text-zinc-500">({data.shortSha})</span>
          </h1>
        )}
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {data && (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-500">
              <th className="border-b border-black/10 pb-2 pr-4 font-medium dark:border-white/10">Path</th>
              <th className="border-b border-black/10 pb-2 pr-4 font-medium dark:border-white/10">Size</th>
              <th className="border-b border-black/10 pb-2 pr-4 font-medium dark:border-white/10">Format</th>
              <th className="border-b border-black/10 pb-2 font-medium dark:border-white/10">Download</th>
            </tr>
          </thead>
          <tbody>
            {data.files.map((f) => (
              <tr key={f.path}>
                <td className="py-1.5 pr-4 font-mono text-black dark:text-zinc-100">{f.path}</td>
                <td className="py-1.5 pr-4 text-zinc-600 dark:text-zinc-400">{formatSize(f.sizeBytes)}</td>
                <td className="py-1.5 pr-4 text-zinc-600 dark:text-zinc-400">
                  {f.metrics?.format ?? 'unknown'}
                </td>
                <td className="py-1.5">
                  {f.downloadUrl ? (
                    <a
                      href={f.downloadUrl}
                      className="text-sky-600 underline decoration-dotted underline-offset-2 hover:decoration-solid dark:text-sky-400"
                    >
                      download
                    </a>
                  ) : (
                    <span className="text-zinc-500">unavailable</span>
                  )}
                </td>
              </tr>
            ))}
            {data.files.length === 0 && (
              <tr>
                <td className="py-2 text-zinc-500" colSpan={4}>
                  No files at this ref.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
