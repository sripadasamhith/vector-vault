// Auth guards every API route calls before touching lib/domain/**
// (ARCHITECTURE.md §2, §6). Written now as part of T0.6 (dashboard's
// POST/GET /api/repos need requireUser()); this is T1.1's file, along with
// envelope.ts.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { fail } from './envelope';

export type Role = 'reader' | 'writer' | 'owner';

const ROLE_RANK: Record<Role, number> = { reader: 0, writer: 1, owner: 2 };

export type RequireUserResult =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; response: ReturnType<typeof fail> };

/**
 * Confirms a request carries a valid Supabase session. Returns the
 * user-scoped client (RLS applies to every query made with it) alongside
 * the user, or a ready-to-return 401 envelope.
 */
export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, response: fail('unauthorized', 'Sign in required.') };
  }

  return { ok: true, user, supabase };
}

export type RequireRepoRoleResult =
  | { ok: true; user: User; supabase: SupabaseClient; role: Role }
  | { ok: false; response: ReturnType<typeof fail> };

/**
 * requireUser() plus a role check against a specific repo. `min` is the
 * lowest role that may proceed (reader < writer < owner).
 *
 * Because the repo lookup uses the RLS-scoped client, a repo the caller
 * cannot see at all (private, not a member, not public) comes back as zero
 * rows and this returns `not_found` — the same shape a real 404 would have,
 * so a probing request can't distinguish "doesn't exist" from "exists but
 * you can't see it". A repo the caller *can* see but doesn't have `min`
 * role on (e.g. a reader hitting a writer-only route) returns `forbidden`.
 */
export async function requireRepoRole(
  repoId: string,
  min: Role
): Promise<RequireRepoRoleResult> {
  const userResult = await requireUser();
  if (!userResult.ok) return userResult;
  const { user, supabase } = userResult;

  const { data: repo, error: repoError } = await supabase
    .from('repos')
    .select('id, owner_id, visibility')
    .eq('id', repoId)
    .maybeSingle();

  if (repoError || !repo) {
    return { ok: false, response: fail('not_found', 'Repo not found.') };
  }

  let role: Role;
  if (repo.owner_id === user.id) {
    role = 'owner';
  } else {
    const { data: membership } = await supabase
      .from('repo_members')
      .select('role')
      .eq('repo_id', repoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership?.role === 'owner' || membership?.role === 'writer' || membership?.role === 'reader') {
      role = membership.role;
    } else if (repo.visibility === 'public') {
      // The repos_select RLS policy let this row through for one of three
      // reasons: ownership (handled above), membership (handled above), or
      // public visibility. If neither of the first two applied, it must be
      // the third.
      role = 'reader';
    } else {
      return { ok: false, response: fail('forbidden', 'You do not have access to this repo.') };
    }
  }

  if (ROLE_RANK[role] < ROLE_RANK[min]) {
    return {
      ok: false,
      response: fail('forbidden', `This action requires ${min} access; you have ${role}.`),
    };
  }

  return { ok: true, user, supabase, role };
}
