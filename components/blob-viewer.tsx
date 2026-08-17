'use client';

// T2.5 + T2.6 (BUILD.md) / ARCHITECTURE.md §8. Fetches the blob's bytes via
// GET /api/blobs/[sha256]/url, parses them off the main thread through the
// T2.4 worker, and either renders <Viewer> or an honest "preview
// unavailable" message (C4 in PLAN.md) — never a fake preview, never a
// thrown exception.
//
// <Viewer> is dynamically imported with ssr: false because it touches
// `window` at module scope via three.js's WebGLRenderer (ARCHITECTURE.md
// §8) — importing it directly here (a client component, but one that could
// still be evaluated during the server render pass) would break the build.
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getBlobDownloadUrl } from '@/lib/client-api';
import { useMeshWorker } from '@/lib/mesh/useMeshWorker';
import type { MeshMetrics } from '@/lib/mesh/types';

const Viewer = dynamic(() => import('./viewer').then((m) => m.Viewer), { ssr: false });

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'unparseable'; format: string }
  | { phase: 'ready'; positions: Float32Array; bbox: MeshMetrics['bbox'] };

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 || dot === filename.length - 1 ? '' : filename.slice(dot + 1);
}

export function BlobViewer({ sha256, filename }: { sha256: string; filename: string }) {
  const { parseBuffer } = useMeshWorker();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });

    (async () => {
      const urlResult = await getBlobDownloadUrl(sha256);
      if ('error' in urlResult) {
        if (!cancelled) setState({ phase: 'error', message: urlResult.error.message });
        return;
      }

      const res = await fetch(urlResult.data.url);
      if (!res.ok) {
        if (!cancelled) {
          setState({ phase: 'error', message: `Failed to download file (status ${res.status}).` });
        }
        return;
      }

      const buffer = await res.arrayBuffer();
      const response = await parseBuffer(filename, buffer);
      if (cancelled) return;

      if (response.kind === 'parsed') {
        setState({ phase: 'ready', positions: response.positions, bbox: response.metrics.bbox });
      } else {
        setState({ phase: 'unparseable', format: response.format });
      }
    })().catch((err: unknown) => {
      if (!cancelled) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Failed to load preview.',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sha256, filename, parseBuffer]);

  if (state.phase === 'loading') {
    return <p className="text-sm text-zinc-500">Loading preview...</p>;
  }

  if (state.phase === 'error') {
    return <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>;
  }

  if (state.phase === 'unparseable') {
    const ext = extensionOf(filename);
    return (
      <p className="text-sm text-zinc-500">
        Preview unavailable for {ext ? `.${ext}` : 'this'} files — the file is stored and
        versioned.
      </p>
    );
  }

  return <Viewer positions={state.positions} bbox={state.bbox} />;
}
