// lib/domain/** owns query logic (ARCHITECTURE.md §2). T4.2 — `revert
// <ref>`: BUILD.md says create_commit() already exists and is applied
// live, and to reuse it rather than writing a second commit path if
// possible. This does: diff the target ref's file snapshot against the
// branch's current HEAD, write the difference as staged_files rows (the
// same shape `add`/`rm` write), then call createCommit() exactly as the
// `commit` command does. That's the only transactional step
// (ARCHITECTURE.md §5) and it is not duplicated here.
//
// This *replaces* whatever the caller had staged on this branch — a
// deliberate, all-or-nothing operation, not a merge with pending staged
// work. If the target ref is already byte-identical to HEAD, the staged
// diff is empty and create_commit() will refuse with `nothing_staged`,
// which is the right outcome ("revert to the current state" is a no-op).
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRef } from './refs';
import { getCommitFiles } from './commits';
import { createCommit, type CreateCommitResult } from './commits';

export type RevertError =
  | { kind: 'ref_not_found'; ref: string }
  | { kind: 'branch_not_found' }
  | { kind: 'nothing_staged' }
  | { kind: 'unknown'; message: string };

export type RevertResult = { ok: true; commitId: string; shortSha: string } | { ok: false; error: RevertError };

export async function revertToRef(
  supabase: SupabaseClient,
  params: { repoId: string; branch: string; ref: string; userId: string; message?: string }
): Promise<RevertResult> {
  const target = await resolveRef(supabase, params.repoId, params.ref);
  if (!target) {
    return { ok: false, error: { kind: 'ref_not_found', ref: params.ref } };
  }

  const headCommit = await resolveRef(supabase, params.repoId, params.branch);
  const headFiles = headCommit ? await getCommitFiles(supabase, headCommit.id) : [];
  const targetFiles = await getCommitFiles(supabase, target.id);

  const targetByPath = new Map(targetFiles.map((f) => [f.path, f.sha256]));
  const headPaths = new Set(headFiles.map((f) => f.path));

  // Replace this user's staged state on this branch with exactly the diff
  // needed to reach the target's file set.
  const { error: clearError } = await supabase
    .from('staged_files')
    .delete()
    .eq('repo_id', params.repoId)
    .eq('user_id', params.userId)
    .eq('branch', params.branch);
  if (clearError) return { ok: false, error: { kind: 'unknown', message: clearError.message } };

  const rows: { repo_id: string; user_id: string; branch: string; path: string; sha256: string | null }[] = [];

  for (const [path, sha256] of targetByPath) {
    rows.push({ repo_id: params.repoId, user_id: params.userId, branch: params.branch, path, sha256 });
  }
  for (const path of headPaths) {
    if (!targetByPath.has(path)) {
      rows.push({ repo_id: params.repoId, user_id: params.userId, branch: params.branch, path, sha256: null });
    }
  }

  if (rows.length > 0) {
    const { error: stageError } = await supabase.from('staged_files').insert(rows);
    if (stageError) return { ok: false, error: { kind: 'unknown', message: stageError.message } };
  }

  const message = params.message ?? `Revert to ${params.ref} (${target.short_sha})`;
  const commitResult: CreateCommitResult = await createCommit(supabase, {
    repoId: params.repoId,
    branch: params.branch,
    message,
    authorId: params.userId,
  });

  if (!commitResult.ok) {
    if (commitResult.error.kind === 'branch_not_found') {
      return { ok: false, error: { kind: 'branch_not_found' } };
    }
    if (commitResult.error.kind === 'nothing_staged') {
      return { ok: false, error: { kind: 'nothing_staged' } };
    }
    return { ok: false, error: { kind: 'unknown', message: commitResult.error.message } };
  }

  return { ok: true, commitId: commitResult.commitId, shortSha: commitResult.shortSha };
}
