// lib/domain/** owns query logic (ARCHITECTURE.md §2). T1.5: the JS side of
// the commit RPC — everything transactional lives in create_commit()
// (supabase/migrations/0002_create_commit.sql); this module only calls it
// via supabase.rpc() and shapes the result/error, per ARCHITECTURE.md §5's
// instruction not to implement the transactional step client-side.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Commit {
  id: string;
  repo_id: string;
  parent_id: string | null;
  short_sha: string;
  message: string;
  author_id: string;
  created_at: string;
}

export interface CommitFile {
  path: string;
  sha256: string | null;
  /** From the joined blobs row. Null only if sha256 itself is null (should
   * not happen in a committed snapshot — staged deletions never make it
   * into commit_files). */
  sizeBytes: number | null;
}

export type CreateCommitError =
  | { kind: 'nothing_staged' }
  | { kind: 'branch_not_found' }
  | { kind: 'unknown'; message: string };

export type CreateCommitResult =
  | { ok: true; commitId: string; shortSha: string }
  | { ok: false; error: CreateCommitError };

/**
 * Calls create_commit(repo, branch, message, author) — one Postgres RPC,
 * one transaction (ARCHITECTURE.md §5 step 5). Distinguishes the two named
 * failure modes the function raises: `nothing_staged` (plain message) and
 * the branch-doesn't-exist case (errcode P0002).
 */
export async function createCommit(
  supabase: SupabaseClient,
  params: { repoId: string; branch: string; message: string; authorId: string }
): Promise<CreateCommitResult> {
  const { data, error } = await supabase
    .rpc('create_commit', {
      p_repo_id: params.repoId,
      p_branch: params.branch,
      p_message: params.message,
      p_author: params.authorId,
    })
    .single();

  if (error) {
    if (error.code === 'P0002' || /does not exist/.test(error.message)) {
      return { ok: false, error: { kind: 'branch_not_found' } };
    }
    if (error.message?.includes('nothing_staged')) {
      return { ok: false, error: { kind: 'nothing_staged' } };
    }
    return { ok: false, error: { kind: 'unknown', message: error.message } };
  }

  const row = data as { commit_id: string; short_sha: string };
  return { ok: true, commitId: row.commit_id, shortSha: row.short_sha };
}

/**
 * Commit history for a branch, newest first, walking the parent_id chain
 * from the branch's current head. Repos in scope for v1 hold tens of
 * commits, so N single-row lookups (N = min(limit, chain length)) is
 * simpler and clearer than a hand-rolled recursive CTE via PostgREST.
 */
export async function listCommits(
  supabase: SupabaseClient,
  params: { repoId: string; branch: string; limit?: number }
): Promise<Commit[]> {
  const limit = params.limit ?? 50;

  const { data: branchRow, error: branchError } = await supabase
    .from('branches')
    .select('head_id')
    .eq('repo_id', params.repoId)
    .eq('name', params.branch)
    .maybeSingle();

  if (branchError) throw new Error(branchError.message);
  if (!branchRow || !branchRow.head_id) return [];

  const commits: Commit[] = [];
  let cursor: string | null = branchRow.head_id;

  while (cursor && commits.length < limit) {
    const { data: commit, error } = await supabase
      .from('commits')
      .select('id, repo_id, parent_id, short_sha, message, author_id, created_at')
      .eq('id', cursor)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!commit) break;

    commits.push(commit as Commit);
    cursor = (commit as Commit).parent_id;
  }

  return commits;
}

/** One commit's full file snapshot (ARCHITECTURE.md §5 — commits are
 * snapshots, not diffs). */
export async function getCommitFiles(
  supabase: SupabaseClient,
  commitId: string
): Promise<CommitFile[]> {
  const { data, error } = await supabase
    .from('commit_files')
    .select('path, sha256, blobs(size_bytes)')
    .eq('commit_id', commitId)
    .order('path', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { path: string; sha256: string | null; blobs: { size_bytes: number } | null }[]).map(
    (row) => ({ path: row.path, sha256: row.sha256, sizeBytes: row.blobs?.size_bytes ?? null })
  );
}

/** One commit row by id, or null. Used by resolveRef (T1.6) and the
 * single-commit route/page. */
export async function getCommit(supabase: SupabaseClient, commitId: string): Promise<Commit | null> {
  const { data, error } = await supabase
    .from('commits')
    .select('id, repo_id, parent_id, short_sha, message, author_id, created_at')
    .eq('id', commitId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Commit) ?? null;
}
