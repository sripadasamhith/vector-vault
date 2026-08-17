// T4.2 (BUILD.md) — POST /api/repos/:id/revert (writer+). Parses,
// validates, and delegates to lib/domain/revert.ts; no query logic here
// (ARCHITECTURE.md §2).
import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { revertToRef } from '@/lib/domain/revert';
import { getDefaultBranch } from '@/lib/domain/repos';

const revertSchema = z.object({
  ref: z.string().min(1).max(255),
  branch: z.string().min(1).max(255).optional(),
  message: z.string().min(1).max(2000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'writer');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = revertSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const branch = parsed.data.branch ?? (await getDefaultBranch(auth.supabase, repoId));

  const result = await revertToRef(auth.supabase, {
    repoId,
    branch,
    ref: parsed.data.ref,
    userId: auth.user.id,
    message: parsed.data.message,
  });

  if (!result.ok) {
    if (result.error.kind === 'ref_not_found') {
      return fail('not_found', `Ref "${result.error.ref}" does not resolve to a commit.`);
    }
    if (result.error.kind === 'branch_not_found') {
      return fail('not_found', `Branch "${branch}" does not exist.`);
    }
    if (result.error.kind === 'nothing_staged') {
      return fail('nothing_staged', `"${parsed.data.ref}" is already the file set at ${branch}'s HEAD — nothing to revert.`);
    }
    return fail('invalid_input', result.error.message);
  }

  return ok({ commitId: result.commitId, shortSha: result.shortSha, branch }, 201);
}
