'use client';

// T2.4 (BUILD.md) / ARCHITECTURE.md §1. The React boundary around
// lib/mesh/worker.ts — the only place a component reaches into lib/mesh/**.
// Instantiated exactly as ARCHITECTURE.md §7/§8 specify:
// `new Worker(new URL('./worker.ts', import.meta.url))`, so both webpack
// and Turbopack bundle worker.ts as a separate chunk for both `next dev`
// and the Vercel build.
import { useCallback, useEffect, useRef } from 'react';
import type { MeshWorkerRequest, MeshWorkerResponse } from './worker';

let nextRequestId = 0;

export interface UseMeshWorkerResult {
  /**
   * Parses `buffer` (already-read file bytes, e.g. from `file.arrayBuffer()`)
   * off the main thread. `buffer` is transferred into the worker — do not
   * read from it again after calling this.
   */
  parseBuffer: (filename: string, buffer: ArrayBuffer) => Promise<MeshWorkerResponse>;
}

/**
 * Owns a single Worker instance for the component's lifetime and terminates
 * it on unmount. All mesh parsing happens inside that worker — the main
 * thread never calls lib/mesh/parse.ts directly (ARCHITECTURE.md §7).
 */
export function useMeshWorker(): UseMeshWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, (response: MeshWorkerResponse) => void>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<MeshWorkerResponse>) => {
      const resolve = pendingRef.current.get(event.data.id);
      if (!resolve) return;
      pendingRef.current.delete(event.data.id);
      resolve(event.data);
    };
    workerRef.current = worker;
    const pending = pendingRef.current;

    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.clear();
    };
  }, []);

  const parseBuffer = useCallback((filename: string, buffer: ArrayBuffer) => {
    return new Promise<MeshWorkerResponse>((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error('mesh worker is not available'));
        return;
      }
      const id = `${Date.now()}-${nextRequestId++}`;
      pendingRef.current.set(id, resolve);
      const request: MeshWorkerRequest = { id, filename, buffer };
      worker.postMessage(request, [buffer]);
    });
  }, []);

  return { parseBuffer };
}
