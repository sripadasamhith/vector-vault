// lib/domain/** owns query logic (ARCHITECTURE.md §2). T4.2 — `tag` (list)
// and `tag <name> [<ref>]` (create). PLAN.md §4's tags table has no
// unique-per-name constraint beyond the primary key (repo_id, name), so a
// duplicate name is a primary-key violation (23505), same pattern as
// createBranch()/createRepo().
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRef } from './refs';

export interface Tag {
  repo_id: string;
  name: string;
  commit_id: string;
  note: string | null;
  created_at?: string;
}

export type CreateTagError =
  | { kind: 'already_exists' }
  | { kind: 'ref_not_found'; ref: string }
  | { kind: 'unknown'; message: string };

export type CreateTagResult = { ok: true; tag: Tag } | { ok: false; error: CreateTagError };

/** Tags a commit. `ref` defaults to HEAD (the repo's default branch), same
 * default precedent as other ref-taking operations in this codebase. */
export async function createTag(
  supabase: SupabaseClient,
  params: { repoId: string; name: string; ref?: string; note?: string }
): Promise<CreateTagResult> {
  const ref = params.ref ?? 'HEAD';
  const commit = await resolveRef(supabase, params.repoId, ref);
  if (!commit) {
    return { ok: false, error: { kind: 'ref_not_found', ref } };
  }

  const { data, error } = await supabase
    .from('tags')
    .insert({ repo_id: params.repoId, name: params.name, commit_id: commit.id, note: params.note ?? null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: { kind: 'already_exists' } };
    }
    return { ok: false, error: { kind: 'unknown', message: error.message } };
  }

  return { ok: true, tag: data as Tag };
}

export interface TagWithShortSha extends Tag {
  short_sha: string;
}

/** Tags with the commit's short_sha joined in, for display (`tag` with no
 * args — PLAN.md §6). */
export async function listTags(supabase: SupabaseClient, repoId: string): Promise<TagWithShortSha[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('repo_id, name, commit_id, note, commits(short_sha)')
    .eq('repo_id', repoId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (Tag & { commits: { short_sha: string } | null })[]).map((row) => ({
    repo_id: row.repo_id,
    name: row.name,
    commit_id: row.commit_id,
    note: row.note,
    short_sha: row.commits?.short_sha ?? '(unknown)',
  }));
}
