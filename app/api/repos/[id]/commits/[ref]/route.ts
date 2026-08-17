// One commit + its file snapshot at an arbitrary ref (HEAD / branch / tag /
// short sha, per lib/domain/refs.ts). Not explicitly named to a single
// BUILD.md task — it's the plumbing T1.7's `ls` command and T1.8's file
// browser both need (ARCHITECTURE.md §1 already lists this path in the file
// tree), so it lands here rather than being duplicated per-caller.
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { resolveRef } from '@/lib/domain/refs';
import { getCommitFiles } from '@/lib/domain/commits';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; ref: string }> }
) {
  const { id: repoId, ref } = await params;
  const auth = await requireRepoRole(repoId, 'reader');
  if (!auth.ok) return auth.response;

  const commit = await resolveRef(auth.supabase, repoId, decodeURIComponent(ref));
  if (!commit) {
    return fail('not_found', `Ref "${ref}" does not resolve to a commit.`);
  }

  const files = await getCommitFiles(auth.supabase, commit.id);
  return ok({ commit, files });
}
