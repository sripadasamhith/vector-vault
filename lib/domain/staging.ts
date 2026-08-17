// lib/domain/** owns query logic (ARCHITECTURE.md §2). T1.4: staging a file
// after it has already landed in Storage (T1.2/T1.3 already happened by the
// time this runs) — upsert blobs, optionally blob_metrics, and staged_files.
// Not in ARCHITECTURE.md §1's original file-tree enumeration, same as
// lib/domain/repos.ts and lib/domain/uploads.ts before it: query logic
// belongs in lib/domain/**, and that list predates several tasks.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { KnownFormat } from '../mesh/types';

export interface StageMetricsInput {
  format: KnownFormat;
  triangleCount: number | null;
  volumeMm3: number | null;
  surfaceAreaMm2: number | null;
  bbox: { min: [number, number, number]; max: [number, number, number] } | null;
  centroid: [number, number, number] | null;
  isWatertight: boolean | null;
}

export type StageFileResult = { ok: true } | { ok: false; message: string };

/**
 * POST /api/repos/:id/stage. `metrics` is optional and untrusted
 * (ARCHITECTURE.md §9, PLAN.md §3) — the route layer range-checks it before
 * this is called; this function only persists what it's given. `blobs` is
 * content-addressed and immutable, so its upsert never overwrites an
 * existing row's storage_path/size_bytes (ignoreDuplicates).
 *
 * `size` is optional: the `add <path>` command (T1.7) re-stages a path that
 * is already part of HEAD, where the blob is already known to exist and no
 * new size reading is available. When omitted, the blobs upsert is skipped
 * entirely rather than risk writing a wrong/guessed size_bytes.
 */
export async function stageFile(
  supabase: SupabaseClient,
  params: {
    repoId: string;
    userId: string;
    branch: string;
    path: string;
    sha256: string;
    size?: number;
    metrics: StageMetricsInput | null;
  }
): Promise<StageFileResult> {
  if (params.size !== undefined) {
    const { error: blobError } = await supabase
      .from('blobs')
      .upsert(
        { sha256: params.sha256, storage_path: `blobs/${params.sha256}`, size_bytes: params.size },
        { onConflict: 'sha256', ignoreDuplicates: true }
      );
    if (blobError) return { ok: false, message: blobError.message };
  }

  if (params.metrics) {
    const { error: metricsError } = await supabase.from('blob_metrics').upsert(
      {
        sha256: params.sha256,
        format: params.metrics.format,
        triangle_count: params.metrics.triangleCount,
        volume_mm3: params.metrics.volumeMm3,
        surface_area_mm2: params.metrics.surfaceAreaMm2,
        bbox: params.metrics.bbox,
        centroid: params.metrics.centroid,
        is_watertight: params.metrics.isWatertight,
        metrics_source: 'client',
      },
      { onConflict: 'sha256' }
    );
    if (metricsError) return { ok: false, message: metricsError.message };
  }

  const { error: stagedError } = await supabase.from('staged_files').upsert(
    {
      repo_id: params.repoId,
      user_id: params.userId,
      branch: params.branch,
      path: params.path,
      sha256: params.sha256,
    },
    { onConflict: 'repo_id,user_id,branch,path' }
  );
  if (stagedError) return { ok: false, message: stagedError.message };

  return { ok: true };
}

/**
 * DELETE /api/repos/:id/stage. Stages a removal: writes a staged_files row
 * with sha256 = null, which create_commit() (0002_create_commit.sql) reads
 * as "drop this path" when the commit is made.
 */
export async function stageRemoval(
  supabase: SupabaseClient,
  params: { repoId: string; userId: string; branch: string; path: string }
): Promise<StageFileResult> {
  const { error } = await supabase.from('staged_files').upsert(
    {
      repo_id: params.repoId,
      user_id: params.userId,
      branch: params.branch,
      path: params.path,
      sha256: null,
    },
    { onConflict: 'repo_id,user_id,branch,path' }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Staged files for a user on a branch — used by `status` (T1.7). */
export async function listStagedFiles(
  supabase: SupabaseClient,
  params: { repoId: string; userId: string; branch: string }
) {
  const { data, error } = await supabase
    .from('staged_files')
    .select('path, sha256, staged_at')
    .eq('repo_id', params.repoId)
    .eq('user_id', params.userId)
    .eq('branch', params.branch)
    .order('path', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
