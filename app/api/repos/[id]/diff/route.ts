// T3.2 (BUILD.md) — GET ?a=<ref>&b=<ref>. Parses query params and delegates
// to lib/domain/diff.ts; no query logic here (ARCHITECTURE.md §2).
//
// Defaults (BUILD.md T3.2): no args -> HEAD vs the caller's working/staged
// state; one ref -> that ref vs HEAD; two refs -> those two refs.
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { diffCommits, diffAgainstStaged } from '@/lib/domain/diff';
import { getDefaultBranch } from '@/lib/domain/repos';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'reader');
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const a = url.searchParams.get('a') || undefined;
  const b = url.searchParams.get('b') || undefined;

  const result = await (async () => {
    if (!a && !b) {
      const branch = await getDefaultBranch(auth.supabase, repoId);
      return diffAgainstStaged(auth.supabase, { repoId, userId: auth.user.id, branch });
    }
    if (a && !b) {
      return diffCommits(auth.supabase, { repoId, refA: a, refB: 'HEAD' });
    }
    if (!a && b) {
      return diffCommits(auth.supabase, { repoId, refA: 'HEAD', refB: b });
    }
    return diffCommits(auth.supabase, { repoId, refA: a as string, refB: b as string });
  })();

  if (!result.ok) {
    return fail('not_found', result.message);
  }

  return ok({ diff: result.result });
}
