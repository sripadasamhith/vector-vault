// lib/domain/** runs server-side and normally owns query logic
// (ARCHITECTURE.md §2). classifyChange() is the one exception carved out for
// this build: it is pure, takes no Supabase client, and is unit-testable in
// isolation. The API route that calls diffCommits() end to end is out of
// scope here.

import type { MeshMetrics } from '../mesh/types';
import { TOLERANCE, withinTolerance } from '../mesh/tolerance';

export type ChangeKind =
  | 'unchanged'
  | 'reexported' // bytes differ, geometry equivalent within tolerance (C6)
  | 'modified'
  | 'added'
  | 'removed'
  | 'binary'; // no metrics available on one or both sides

export interface MetricDelta {
  label: string; // 'volume'
  a: string | null; // '41.20 cm³' — preformatted for display
  b: string | null;
  deltaPct: number | null;
  significant: boolean; // outside TOLERANCE
}

export interface FileChange {
  path: string;
  kind: ChangeKind;
  shaA: string | null;
  shaB: string | null;
  deltas: MetricDelta[]; // empty for added/removed/binary
}

export interface DiffResult {
  a: { ref: string; shortSha: string };
  b: { ref: string; shortSha: string };
  changes: FileChange[];
}

/** One side of a file at a given ref, as classifyChange() needs it. */
export interface FileSide {
  sha256: string;
  /** null when the format is unparseable (C4) — no metrics available. */
  metrics: MeshMetrics | null;
}

function bboxWithinTolerance(a: MeshMetrics['bbox'], b: MeshMetrics['bbox']): boolean {
  for (let i = 0; i < 3; i++) {
    const dimA = a.max[i] - a.min[i];
    const dimB = b.max[i] - b.min[i];
    if (!withinTolerance(dimA, dimB, { absolute: TOLERANCE.absoluteBboxMm })) {
      return false;
    }
  }
  return true;
}

/** True when two MeshMetrics describe the same geometry within TOLERANCE. */
function metricsEquivalent(a: MeshMetrics, b: MeshMetrics): boolean {
  // Volume: only comparable when both sides are watertight. A mismatch in
  // watertightness itself, or a mismatch in volume, is a real difference.
  if (a.isWatertight !== b.isWatertight) return false;
  if (a.isWatertight && b.isWatertight) {
    if (a.volumeMm3 === null || b.volumeMm3 === null) return false;
    if (!withinTolerance(a.volumeMm3, b.volumeMm3, { relative: TOLERANCE.relativeVolume })) {
      return false;
    }
  }

  if (
    !withinTolerance(a.surfaceAreaMm2, b.surfaceAreaMm2, {
      relative: TOLERANCE.relativeSurfaceArea,
    })
  ) {
    return false;
  }

  return bboxWithinTolerance(a.bbox, b.bbox);
}

/**
 * Classifies the change between two sides of the same file path per the
 * six-way table in PLAN.md §5. `a` and `b` are null when the file is absent
 * on that side (added/removed).
 */
export function classifyChange(a: FileSide | null, b: FileSide | null): ChangeKind {
  if (a === null && b === null) {
    throw new Error('classifyChange: both sides are null — nothing to classify');
  }
  if (a === null) return 'added';
  if (b === null) return 'removed';

  if (a.sha256 === b.sha256) return 'unchanged';

  // Bytes differ from here on.
  if (a.metrics === null || b.metrics === null) return 'binary';

  return metricsEquivalent(a.metrics, b.metrics) ? 'reexported' : 'modified';
}
