// lib/domain/** owns query logic (ARCHITECTURE.md §2). T4.1 — branch
// listing already existed as listBranches()/Branch in lib/domain/repos.ts
// (T0.6/T1.8 predates this task); this file adds branch *creation*, kept
// separate because it's new query logic specific to T4.1 rather than
// something repos.ts already had a home for.
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRef } from './refs';
import type { Branch } from './repos';

export type CreateBranchError =
  | { kind: 'already_exists' }
  | { kind: 'ref_not_found'; ref: string }
  | { kind: 'unknown'; message: string };

export type CreateBranchResult = { ok: true; branch: Branch } | { ok: false; error: CreateBranchError };

/**
 * Creates a branch at `fromRef` (BUILD.md T4.1: "Branch creation starts at
 * the current HEAD" — the caller resolves what "current" means, e.g. the
 * checked-out ref, and passes it as `fromRef`). `fromRef` is resolved via
 * resolveRef() so it accepts HEAD/branch/tag/short-sha the same as
 * everywhere else. A repo with no commits yet may still create a branch —
 * `head_id` is simply null, same as the initial `main` branch from T0.6.
 */
export async function createBranch(
  supabase: SupabaseClient,
  params: { repoId: string; name: string; fromRef?: string }
): Promise<CreateBranchResult> {
  let headId: string | null = null;

  if (params.fromRef) {
    const commit = await resolveRef(supabase, params.repoId, params.fromRef);
    if (!commit) {
      return { ok: false, error: { kind: 'ref_not_found', ref: params.fromRef } };
    }
    headId = commit.id;
  }

  const { data, error } = await supabase
    .from('branches')
    .insert({ repo_id: params.repoId, name: params.name, head_id: headId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: { kind: 'already_exists' } };
    }
    return { ok: false, error: { kind: 'unknown', message: error.message } };
  }

  return { ok: true, branch: data as Branch };
}
