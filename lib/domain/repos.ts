// lib/domain/** is the only place that reads or writes tables
// (ARCHITECTURE.md §2). Not in the §1 file tree's enumerated domain files
// (that list predates T0.6), but repo create/list is query logic and
// belongs here rather than inline in app/api/repos/route.ts.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Repo {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  default_branch: string;
  created_at: string;
}

export type CreateRepoError =
  | { kind: 'slug_taken' }
  | { kind: 'unknown'; message: string };

export type CreateRepoResult = { ok: true; repo: Repo } | { ok: false; error: CreateRepoError };

/**
 * Creates a repo plus its `main` branch (head_id null) and an `owner`
 * repo_members row for the creator, per ARCHITECTURE.md §1 / BUILD.md T0.6.
 * Three inserts, not wrapped in a DB transaction (no RPC exists for this —
 * unlike create_commit(), a partial failure here just leaves an orphaned
 * repos row, which is recoverable, not silently wrong data).
 */
export async function createRepo(
  supabase: SupabaseClient,
  params: { ownerId: string; slug: string; name: string; description?: string }
): Promise<CreateRepoResult> {
  const { data: repo, error: repoError } = await supabase
    .from('repos')
    .insert({
      owner_id: params.ownerId,
      slug: params.slug,
      name: params.name,
      description: params.description ?? null,
    })
    .select()
    .single();

  if (repoError) {
    if (repoError.code === '23505') {
      return { ok: false, error: { kind: 'slug_taken' } };
    }
    return { ok: false, error: { kind: 'unknown', message: repoError.message } };
  }

  const { error: branchError } = await supabase
    .from('branches')
    .insert({ repo_id: repo.id, name: repo.default_branch, head_id: null });

  if (branchError) {
    return { ok: false, error: { kind: 'unknown', message: branchError.message } };
  }

  const { error: memberError } = await supabase
    .from('repo_members')
    .insert({ repo_id: repo.id, user_id: params.ownerId, role: 'owner' });

  if (memberError) {
    return { ok: false, error: { kind: 'unknown', message: memberError.message } };
  }

  return { ok: true, repo: repo as Repo };
}

/** The repo's configured default branch — used to resolve an omitted
 * `branch` param on staging/commit routes to something real. */
export async function getDefaultBranch(supabase: SupabaseClient, repoId: string): Promise<string> {
  const { data } = await supabase
    .from('repos')
    .select('default_branch')
    .eq('id', repoId)
    .maybeSingle();
  return data?.default_branch ?? 'main';
}

/** Repos owned by this user, newest first. */
export async function listOwnedRepos(supabase: SupabaseClient, ownerId: string): Promise<Repo[]> {
  const { data, error } = await supabase
    .from('repos')
    .select()
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Repo[];
}

/**
 * T1.8's [owner]/[repo] route segments: `owner` is the owner's user id (no
 * separate username/profile table exists in this schema — PLAN.md §4 has no
 * such table — so the URL segment is the uuid itself) and `repo` is the
 * slug, unique per owner. Uses the RLS-scoped client, so a repo the caller
 * cannot see comes back as null exactly like a nonexistent one
 * (ARCHITECTURE.md §6/guard.ts's requireRepoRole does the same thing).
 */
export async function getRepoByOwnerAndSlug(
  supabase: SupabaseClient,
  ownerId: string,
  slug: string
): Promise<Repo | null> {
  const { data, error } = await supabase
    .from('repos')
    .select()
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Repo) ?? null;
}

export interface Branch {
  repo_id: string;
  name: string;
  head_id: string | null;
  created_at: string;
}

export async function listBranches(supabase: SupabaseClient, repoId: string): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select()
    .eq('repo_id', repoId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Branch[];
}
