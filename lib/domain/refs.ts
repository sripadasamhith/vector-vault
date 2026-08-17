// lib/domain/** owns query logic (ARCHITECTURE.md §2). T1.6 — resolveRef()
// is the one shared helper every ref-taking route/command goes through
// (PLAN.md §7), handling HEAD, branch name, tag name, and short SHA in that
// precedence order. `HEAD` means "the repo's default branch's current
// commit" — there's no separate per-request checkout state yet (that's
// T4.1's detached-view banner), so this is the only sensible reading.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Commit } from './commits';
import { getDefaultBranch } from './repos';

async function commitById(supabase: SupabaseClient, commitId: string): Promise<Commit | null> {
  const { data, error } = await supabase
    .from('commits')
    .select('id, repo_id, parent_id, short_sha, message, author_id, created_at')
    .eq('id', commitId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Commit) ?? null;
}

async function resolveBranchHead(
  supabase: SupabaseClient,
  repoId: string,
  branch: string
): Promise<Commit | null> {
  const { data, error } = await supabase
    .from('branches')
    .select('head_id')
    .eq('repo_id', repoId)
    .eq('name', branch)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.head_id) return null;
  return commitById(supabase, data.head_id);
}

async function resolveTag(
  supabase: SupabaseClient,
  repoId: string,
  tag: string
): Promise<Commit | null> {
  const { data, error } = await supabase
    .from('tags')
    .select('commit_id')
    .eq('repo_id', repoId)
    .eq('name', tag)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.commit_id) return null;
  return commitById(supabase, data.commit_id);
}

async function resolveShortSha(
  supabase: SupabaseClient,
  repoId: string,
  shortSha: string
): Promise<Commit | null> {
  const { data, error } = await supabase
    .from('commits')
    .select('id, repo_id, parent_id, short_sha, message, author_id, created_at')
    .eq('repo_id', repoId)
    .eq('short_sha', shortSha)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Commit) ?? null;
}

/**
 * Resolves `ref` to a commit row, trying in order: `HEAD`, branch name, tag
 * name, short SHA. Returns null if none match (PLAN.md §7 / BUILD.md T1.6).
 */
export async function resolveRef(
  supabase: SupabaseClient,
  repoId: string,
  ref: string
): Promise<Commit | null> {
  if (ref === 'HEAD') {
    const branch = await getDefaultBranch(supabase, repoId);
    return resolveBranchHead(supabase, repoId, branch);
  }

  const branchCommit = await resolveBranchHead(supabase, repoId, ref);
  if (branchCommit) return branchCommit;

  const tagCommit = await resolveTag(supabase, repoId, ref);
  if (tagCommit) return tagCommit;

  const shaCommit = await resolveShortSha(supabase, repoId, ref);
  if (shaCommit) return shaCommit;

  return null;
}
