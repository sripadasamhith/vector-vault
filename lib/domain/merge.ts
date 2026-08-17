// lib/domain/** owns query logic (ARCHITECTURE.md §2). T4.3 — `merge
// <ref>` (constraint C5, PLAN.md §1/§6): fast-forward is pointer movement
// and is allowed; true divergence must refuse, naming the files that
// changed on both sides, and must create no commit.
//
// Not in ARCHITECTURE.md §1's original route enumeration (that list
// predates T4.3) — merge needs a dedicated endpoint distinct from
// /commits because a fast-forward merge moves branches.head_id directly
// without going through create_commit() (there is nothing to snapshot;
// the target commit already exists), and a diverged merge must be
// detectable and refusable before anything is written. Recorded here per
// BUILD.md rule 1 ("reason recorded in a commit message") and in the
// [T4.3] commit.
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRef } from './refs';
import { getCommit, getCommitFiles, type Commit } from './commits';

export type MergeResult =
  | { ok: true; kind: 'fast-forward'; shortSha: string }
  | { ok: true; kind: 'up-to-date' }
  | { ok: false; kind: 'diverged'; divergedFiles: string[] }
  | { ok: false; kind: 'not_found'; message: string };

/** Walks the parent_id chain from `startId` upward, collecting every commit
 * id visited (inclusive of startId), stopping at the root (parent_id null).
 * Repos in v1 scope hold tens of commits, so this is a handful of
 * single-row lookups, same tradeoff as listCommits() in commits.ts. */
async function ancestorIds(supabase: SupabaseClient, startId: string | null): Promise<Set<string>> {
  const seen = new Set<string>();
  let cursor = startId;
  while (cursor) {
    if (seen.has(cursor)) break; // defensive: no cycles should exist, but don't hang if one did
    seen.add(cursor);
    const commit = await getCommit(supabase, cursor);
    cursor = commit?.parent_id ?? null;
  }
  return seen;
}

/** Lowest common ancestor of two commits, found by walking both parent
 * chains. Returns null if there's no shared ancestor (shouldn't happen
 * within one repo, since every branch traces back to the same root, but
 * handled rather than assumed). */
async function findCommonAncestor(
  supabase: SupabaseClient,
  aId: string,
  bId: string
): Promise<string | null> {
  const aAncestors = await ancestorIds(supabase, aId);
  let cursor: string | null = bId;
  while (cursor) {
    if (aAncestors.has(cursor)) return cursor;
    const commit: Commit | null = await getCommit(supabase, cursor);
    cursor = commit?.parent_id ?? null;
  }
  return null;
}

/**
 * Merges `sourceRef` into `targetBranch`. Fast-forward when `targetBranch`'s
 * head is an ancestor of (or equal to) the source commit — moves
 * branches.head_id directly, no new commit. Refuses with the diverged file
 * list when neither side is an ancestor of the other and at least one path
 * changed differently on both sides relative to their common ancestor.
 */
export async function mergeBranch(
  supabase: SupabaseClient,
  params: { repoId: string; targetBranch: string; sourceRef: string }
): Promise<MergeResult> {
  const source = await resolveRef(supabase, params.repoId, params.sourceRef);
  if (!source) {
    return { ok: false, kind: 'not_found', message: `Ref "${params.sourceRef}" does not resolve to a commit.` };
  }

  const target = await resolveRef(supabase, params.repoId, params.targetBranch);

  if (!target) {
    // Target branch has no commits yet: moving its head to the source is
    // unambiguously a fast-forward (there is nothing on the target side to
    // lose).
    const { error } = await supabase
      .from('branches')
      .update({ head_id: source.id })
      .eq('repo_id', params.repoId)
      .eq('name', params.targetBranch);
    if (error) return { ok: false, kind: 'not_found', message: error.message };
    return { ok: true, kind: 'fast-forward', shortSha: source.short_sha };
  }

  if (target.id === source.id) {
    return { ok: true, kind: 'up-to-date' };
  }

  // Fast-forward: target is an ancestor of source (source is strictly
  // ahead). Walking from source upward is enough — no LCA needed.
  const sourceAncestors = await ancestorIds(supabase, source.id);
  if (sourceAncestors.has(target.id)) {
    const { error } = await supabase
      .from('branches')
      .update({ head_id: source.id })
      .eq('repo_id', params.repoId)
      .eq('name', params.targetBranch);
    if (error) return { ok: false, kind: 'not_found', message: error.message };
    return { ok: true, kind: 'fast-forward', shortSha: source.short_sha };
  }

  // Source is an ancestor of target: target already has everything source
  // has. Not a fast-forward (nothing to move) and not a conflict either.
  const targetAncestors = await ancestorIds(supabase, target.id);
  if (targetAncestors.has(source.id)) {
    return { ok: true, kind: 'up-to-date' };
  }

  // True divergence. Find the common ancestor and diff both sides against
  // it to name exactly the files that changed on both branches (C5: "no
  // commit may be created", and the refusal must name the diverged files).
  const ancestorId = await findCommonAncestor(supabase, target.id, source.id);

  const [targetFiles, sourceFiles, ancestorFiles] = await Promise.all([
    getCommitFiles(supabase, target.id),
    getCommitFiles(supabase, source.id),
    ancestorId ? getCommitFiles(supabase, ancestorId) : Promise.resolve([]),
  ]);

  const targetMap = new Map(targetFiles.map((f) => [f.path, f.sha256]));
  const sourceMap = new Map(sourceFiles.map((f) => [f.path, f.sha256]));
  const ancestorMap = new Map(ancestorFiles.map((f) => [f.path, f.sha256]));

  const allPaths = new Set([...targetMap.keys(), ...sourceMap.keys()]);
  const diverged: string[] = [];

  for (const path of allPaths) {
    const t = targetMap.get(path) ?? null;
    const s = sourceMap.get(path) ?? null;
    const base = ancestorMap.get(path) ?? null;
    if (t === s) continue; // both sides agree, nothing to resolve
    const changedOnTarget = t !== base;
    const changedOnSource = s !== base;
    if (changedOnTarget && changedOnSource) {
      diverged.push(path);
    }
  }

  diverged.sort();

  return { ok: false, kind: 'diverged', divergedFiles: diverged };
}
