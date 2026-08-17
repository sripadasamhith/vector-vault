// T4.1 (BUILD.md) — GET list (reader+), POST create (writer+). Parses,
// validates, and delegates to lib/domain/{repos,branches}.ts; no query
// logic here (ARCHITECTURE.md §2).
import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { listBranches } from '@/lib/domain/repos';
import { createBranch } from '@/lib/domain/branches';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  from: z.string().min(1).max(255).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'reader');
  if (!auth.ok) return auth.response;

  const branches = await listBranches(auth.supabase, repoId);
  return ok({ branches });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'writer');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const result = await createBranch(auth.supabase, {
    repoId,
    name: parsed.data.name,
    fromRef: parsed.data.from,
  });

  if (!result.ok) {
    if (result.error.kind === 'already_exists') {
      return fail('conflict', `Branch "${parsed.data.name}" already exists.`);
    }
    if (result.error.kind === 'ref_not_found') {
      return fail('not_found', `Ref "${result.error.ref}" does not resolve to a commit.`);
    }
    return fail('invalid_input', result.error.message);
  }

  return ok({ branch: result.branch }, 201);
}
