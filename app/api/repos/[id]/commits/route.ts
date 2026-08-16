// T1.5 (BUILD.md) — POST commit (writer+), GET log (reader+). Parses,
// validates, and delegates to lib/domain/commits.ts; no query logic here.
import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { createCommit, listCommits } from '@/lib/domain/commits';
import { getDefaultBranch } from '@/lib/domain/repos';

const commitSchema = z.object({
  message: z.string().min(1).max(2000),
  branch: z.string().min(1).max(255).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'writer');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = commitSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const branch = parsed.data.branch ?? (await getDefaultBranch(auth.supabase, repoId));

  const result = await createCommit(auth.supabase, {
    repoId,
    branch,
    message: parsed.data.message,
    authorId: auth.user.id,
  });

  if (!result.ok) {
    if (result.error.kind === 'nothing_staged') {
      return fail('nothing_staged', 'Nothing staged — nothing to commit.');
    }
    if (result.error.kind === 'branch_not_found') {
      return fail('not_found', `Branch "${branch}" does not exist.`);
    }
    return fail('invalid_input', result.error.message);
  }

  return ok({ commitId: result.commitId, shortSha: result.shortSha, branch }, 201);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'reader');
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const branchParam = url.searchParams.get('branch') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : undefined;

  if (limitParam && (!Number.isInteger(limit) || (limit as number) <= 0)) {
    return fail('invalid_input', 'limit must be a positive integer.');
  }

  const branch = branchParam ?? (await getDefaultBranch(auth.supabase, repoId));

  const commits = await listCommits(auth.supabase, { repoId, branch, limit });
  return ok({ commits, branch });
}
