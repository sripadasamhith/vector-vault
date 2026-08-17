// T4.2 (BUILD.md) — GET list (reader+), POST create (writer+). Parses,
// validates, and delegates to lib/domain/tags.ts; no query logic here
// (ARCHITECTURE.md §2).
import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { listTags, createTag } from '@/lib/domain/tags';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  ref: z.string().min(1).max(255).optional(),
  note: z.string().max(2000).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'reader');
  if (!auth.ok) return auth.response;

  const tags = await listTags(auth.supabase, repoId);
  return ok({ tags });
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

  const result = await createTag(auth.supabase, {
    repoId,
    name: parsed.data.name,
    ref: parsed.data.ref,
    note: parsed.data.note,
  });

  if (!result.ok) {
    if (result.error.kind === 'already_exists') {
      return fail('conflict', `Tag "${parsed.data.name}" already exists.`);
    }
    if (result.error.kind === 'ref_not_found') {
      return fail('not_found', `Ref "${result.error.ref}" does not resolve to a commit.`);
    }
    return fail('invalid_input', result.error.message);
  }

  return ok({ tag: result.tag }, 201);
}
