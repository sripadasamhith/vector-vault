// T2.4 (BUILD.md) / ARCHITECTURE.md §1, §7. The one place besides parse.ts
// itself that touches lib/mesh/parse.ts and lib/mesh/metrics.ts directly —
// all parsing happens here, in the Worker, never on the main thread. A 45
// MiB STL (fixtures/large.stl, ~943k triangles) would freeze the UI for
// seconds if parsed inline.
//
// computeWorkerResponse() is exported as a pure function specifically so it
// can be unit-tested without a DOM/Worker global (lib/mesh/** stays testable
// without a browser — ARCHITECTURE.md §2). The `self.onmessage` wiring below
// is the only part that actually depends on running inside a Worker, and is
// guarded so importing this module in a Node test environment (`typeof self
// === 'undefined'`) does not throw.
import { detectFormat, parseMesh } from './parse';
import type { KnownFormat, MeshMetrics } from './types';

export interface MeshWorkerRequest {
  /** Correlates a response to its request — useMeshWorker.ts may have more
   * than one parse in flight against a single worker instance. */
  id: string;
  filename: string;
  buffer: ArrayBuffer;
}

export type MeshWorkerResponse =
  | { id: string; kind: 'parsed'; positions: Float32Array; metrics: MeshMetrics }
  | { id: string; kind: 'unparseable'; format: KnownFormat };

/**
 * Pure request -> response mapping. Never throws: a format we don't have a
 * parser for is reported as `unparseable` (C4 in PLAN.md), and so is a
 * format we DO claim to support but whose bytes are corrupt (a thrown
 * ParseError) — a malformed upload must still degrade gracefully rather
 * than break the upload path (ARCHITECTURE.md §9: "Input is a hostile
 * ArrayBuffer").
 */
export function computeWorkerResponse(request: MeshWorkerRequest): MeshWorkerResponse {
  const { id, filename, buffer } = request;
  try {
    const result = parseMesh(buffer, filename);
    if (result.kind === 'parsed') {
      return {
        id,
        kind: 'parsed',
        positions: result.mesh.positions,
        metrics: result.mesh.metrics,
      };
    }
    return { id, kind: 'unparseable', format: result.format };
  } catch {
    return { id, kind: 'unparseable', format: detectFormat(filename) };
  }
}

// Worker entry point. Guarded so this module can be imported from a Node
// test environment (vitest) without a `self` global.
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  const workerSelf = self as unknown as Worker;
  workerSelf.onmessage = (event: MessageEvent<MeshWorkerRequest>) => {
    const response = computeWorkerResponse(event.data);
    // Transfer the positions buffer to the main thread — never copy it
    // (ARCHITECTURE.md §7/§8).
    const transfer = response.kind === 'parsed' ? [response.positions.buffer] : [];
    workerSelf.postMessage(response, transfer);
  };
}
