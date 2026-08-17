// lib/domain/** runs server-side and normally owns query logic
// (ARCHITECTURE.md §2). classifyChange() is pure and takes no Supabase
// client, unit-testable in isolation — that part predates T3.2. diffCommits()
// and diffAgainstStaged() below are the real query-owning half of this file:
// they resolve refs (lib/domain/refs.ts), read file snapshots
// (lib/domain/commits.ts / lib/domain/staging.ts), and shape a DiffResult.
// api/repos/[id]/diff/route.ts only parses query params and calls these.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { KnownFormat, MeshMetrics } from '../mesh/types';
import { TOLERANCE, withinTolerance } from '../mesh/tolerance';
import { resolveRef } from './refs';
import { getCommitFiles, type CommitFile } from './commits';
import { listStagedFiles } from './staging';

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

// ---------------------------------------------------------------------------
// T3.2 — formatting. Every MetricDelta.a/b is preformatted for display per
// BUILD.md T3.2: cm³ for volume, cm² for area, mm for bbox dimensions, plain
// integers for triangle count. Kept as small named functions so
// lib/domain/__tests__/diff.test.ts can assert on exact strings.

function fmtVolumeCm3(mm3: number | null): string | null {
  if (mm3 === null) return null;
  return `${(mm3 / 1000).toFixed(2)} cm³`;
}

function fmtAreaCm2(mm2: number): string {
  return `${(mm2 / 100).toFixed(2)} cm²`;
}

/** Rounds to 2dp and drops a trailing ".00"/"0" so "20.00" reads as "20". */
function trimDim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function fmtBboxMm(bbox: MeshMetrics['bbox']): string {
  const dims = [0, 1, 2].map((i) => bbox.max[i] - bbox.min[i]);
  return `${dims.map(trimDim).join('×')} mm`;
}

function fmtTriangleCount(n: number): string {
  return String(Math.round(n));
}

/** Percent change from a to b, relative to |a|. Null when a is 0 and b is
 * not (an undefined percentage, not a huge one). */
function pctDelta(a: number, b: number): number | null {
  if (a === 0) return b === 0 ? 0 : null;
  return ((b - a) / Math.abs(a)) * 100;
}

/**
 * The five-row delta table PLAN.md §8 mocks up: volume, surface area,
 * bounding box, triangles, watertight. Only called when both sides have
 * metrics (modified/reexported) — added/removed/binary get an empty array
 * per the FileChange contract. Exported for direct unit testing without a
 * Supabase client, since diffCommits() itself needs one.
 */
export function buildMetricDeltas(a: MeshMetrics, b: MeshMetrics): MetricDelta[] {
  const volA = a.isWatertight ? a.volumeMm3 : null;
  const volB = b.isWatertight ? b.volumeMm3 : null;
  const volumeSignificant =
    volA !== null && volB !== null
      ? !withinTolerance(volA, volB, { relative: TOLERANCE.relativeVolume })
      : a.isWatertight !== b.isWatertight;

  const areaSignificant = !withinTolerance(a.surfaceAreaMm2, b.surfaceAreaMm2, {
    relative: TOLERANCE.relativeSurfaceArea,
  });

  return [
    {
      label: 'volume',
      a: fmtVolumeCm3(volA),
      b: fmtVolumeCm3(volB),
      deltaPct: volA !== null && volB !== null ? pctDelta(volA, volB) : null,
      significant: volumeSignificant,
    },
    {
      label: 'surface area',
      a: fmtAreaCm2(a.surfaceAreaMm2),
      b: fmtAreaCm2(b.surfaceAreaMm2),
      deltaPct: pctDelta(a.surfaceAreaMm2, b.surfaceAreaMm2),
      significant: areaSignificant,
    },
    {
      label: 'bounding box',
      a: fmtBboxMm(a.bbox),
      b: fmtBboxMm(b.bbox),
      deltaPct: null, // three independent dimensions — no single percentage
      significant: !bboxWithinTolerance(a.bbox, b.bbox),
    },
    {
      label: 'triangles',
      a: fmtTriangleCount(a.triangleCount),
      b: fmtTriangleCount(b.triangleCount),
      deltaPct: pctDelta(a.triangleCount, b.triangleCount),
      // Triangle count has no TOLERANCE entry (ARCHITECTURE.md §7) — a
      // tessellation change is expected and informational, never itself
      // "significant" the way volume/area/bbox are.
      significant: false,
    },
    {
      label: 'watertight',
      a: a.isWatertight ? 'yes' : 'no',
      b: b.isWatertight ? 'yes' : 'no',
      deltaPct: null,
      significant: a.isWatertight !== b.isWatertight,
    },
  ];
}

// ---------------------------------------------------------------------------
// T3.2 — diffCommits() / diffAgainstStaged(). The query-owning half.

/** Shape of a blob_metrics row (supabase/migrations/0001_init.sql). */
interface BlobMetricsRow {
  sha256: string;
  format: string;
  triangle_count: number | null;
  volume_mm3: number | null;
  surface_area_mm2: number | null;
  bbox: MeshMetrics['bbox'] | null;
  centroid: MeshMetrics['centroid'] | null;
  is_watertight: boolean | null;
}

/**
 * A blob_metrics row exists for every staged/committed blob, including
 * unparseable ones (C4) — but for those, every column besides `format` is
 * null. That is this function's signal for "no metrics available", the same
 * condition classifyChange() treats as `binary`.
 */
function rowToMeshMetrics(row: BlobMetricsRow | undefined): MeshMetrics | null {
  if (!row) return null;
  if (row.triangle_count === null || row.surface_area_mm2 === null || row.bbox === null || row.centroid === null || row.is_watertight === null) {
    return null;
  }
  return {
    format: row.format as KnownFormat,
    triangleCount: row.triangle_count,
    volumeMm3: row.volume_mm3,
    surfaceAreaMm2: row.surface_area_mm2,
    bbox: row.bbox,
    centroid: row.centroid,
    isWatertight: row.is_watertight,
  };
}

async function fetchBlobMetrics(
  supabase: SupabaseClient,
  shas: string[]
): Promise<Map<string, BlobMetricsRow>> {
  const map = new Map<string, BlobMetricsRow>();
  if (shas.length === 0) return map;

  const { data, error } = await supabase.from('blob_metrics').select('*').in('sha256', shas);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as BlobMetricsRow[]) {
    map.set(row.sha256, row);
  }
  return map;
}

/** Minimal shape buildDiffFileChanges() needs from either side's file list —
 * satisfied by both CommitFile[] and the merged staged-file list. */
interface PathSha {
  path: string;
  sha256: string | null;
}

/**
 * The core of diffCommits()/diffAgainstStaged(): union the two path sets,
 * classify each, and attach a formatted delta table. Takes plain path/sha
 * lists rather than commit ids so it serves both the ref-vs-ref and
 * ref-vs-staged cases identically. Exported for direct unit testing against
 * a stub Supabase client (no real resolveRef/getCommitFiles chain needed).
 */
export async function buildDiffFileChanges(
  supabase: SupabaseClient,
  filesA: PathSha[],
  filesB: PathSha[]
): Promise<FileChange[]> {
  const mapA = new Map(filesA.filter((f) => f.sha256 !== null).map((f) => [f.path, f.sha256 as string]));
  const mapB = new Map(filesB.filter((f) => f.sha256 !== null).map((f) => [f.path, f.sha256 as string]));

  const allPaths = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();

  const shas = Array.from(new Set([...mapA.values(), ...mapB.values()]));
  const metricsBySha = await fetchBlobMetrics(supabase, shas);

  const changes: FileChange[] = [];
  for (const path of allPaths) {
    const shaA = mapA.get(path) ?? null;
    const shaB = mapB.get(path) ?? null;

    const sideA: FileSide | null = shaA ? { sha256: shaA, metrics: rowToMeshMetrics(metricsBySha.get(shaA)) } : null;
    const sideB: FileSide | null = shaB ? { sha256: shaB, metrics: rowToMeshMetrics(metricsBySha.get(shaB)) } : null;

    const kind = classifyChange(sideA, sideB);

    // Git-diff-like: a path with no observable change doesn't clutter the
    // result. The type contract only requires deltas to be empty for
    // added/removed/binary — it doesn't require unchanged paths to be
    // listed at all, and listing every untouched file would bury the
    // signal this feature exists to surface (PLAN.md §5/C6).
    if (kind === 'unchanged') continue;

    const deltas: MetricDelta[] =
      (kind === 'modified' || kind === 'reexported') && sideA?.metrics && sideB?.metrics
        ? buildMetricDeltas(sideA.metrics, sideB.metrics)
        : [];

    changes.push({ path, kind, shaA, shaB, deltas });
  }

  return changes;
}

export type DiffCommitsResult = { ok: true; result: DiffResult } | { ok: false; message: string };

/**
 * diffCommits(repoId, refA, refB) — BUILD.md T3.2. Resolves both refs via
 * the existing resolveRef() (HEAD/branch/tag/short-sha precedence) and
 * diffs their full file snapshots.
 */
export async function diffCommits(
  supabase: SupabaseClient,
  params: { repoId: string; refA: string; refB: string }
): Promise<DiffCommitsResult> {
  const [commitA, commitB] = await Promise.all([
    resolveRef(supabase, params.repoId, params.refA),
    resolveRef(supabase, params.repoId, params.refB),
  ]);

  if (!commitA) return { ok: false, message: `Ref "${params.refA}" does not resolve to a commit.` };
  if (!commitB) return { ok: false, message: `Ref "${params.refB}" does not resolve to a commit.` };

  const [filesA, filesB] = await Promise.all([
    getCommitFiles(supabase, commitA.id),
    getCommitFiles(supabase, commitB.id),
  ]);

  const changes = await buildDiffFileChanges(supabase, filesA, filesB);

  return {
    ok: true,
    result: {
      a: { ref: params.refA, shortSha: commitA.short_sha },
      b: { ref: params.refB, shortSha: commitB.short_sha },
      changes,
    },
  };
}

/**
 * diff with no args (PLAN.md §6 / BUILD.md T3.2 defaults): HEAD vs. the
 * caller's working/staged state on `branch` — HEAD's file snapshot with
 * staged_files overlaid (null sha256 = staged deletion, same semantics
 * create_commit() uses).
 */
export async function diffAgainstStaged(
  supabase: SupabaseClient,
  params: { repoId: string; userId: string; branch: string }
): Promise<DiffCommitsResult> {
  const head = await resolveRef(supabase, params.repoId, 'HEAD');
  const headFiles: CommitFile[] = head ? await getCommitFiles(supabase, head.id) : [];

  const staged = await listStagedFiles(supabase, {
    repoId: params.repoId,
    userId: params.userId,
    branch: params.branch,
  });

  const merged = new Map(headFiles.map((f) => [f.path, f.sha256]));
  for (const s of staged as { path: string; sha256: string | null }[]) {
    if (s.sha256 === null) merged.delete(s.path);
    else merged.set(s.path, s.sha256);
  }
  const stagedFiles: PathSha[] = Array.from(merged.entries()).map(([path, sha256]) => ({ path, sha256 }));

  const changes = await buildDiffFileChanges(supabase, headFiles, stagedFiles);

  return {
    ok: true,
    result: {
      a: { ref: 'HEAD', shortSha: head?.short_sha ?? '(none)' },
      b: { ref: 'staged', shortSha: 'staged' },
      changes,
    },
  };
}
