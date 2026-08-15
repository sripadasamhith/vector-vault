import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireUser } from '@/lib/api/guard';
import { createRepo, listOwnedRepos } from '@/lib/domain/repos';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;

const createRepoSchema = z.object({
  slug: z.string().regex(SLUG_RE, 'slug must match ^[a-z0-9][a-z0-9-]{0,38}$'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createRepoSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const result = await createRepo(auth.supabase, {
    ownerId: auth.user.id,
    slug: parsed.data.slug,
    name: parsed.data.name,
    description: parsed.data.description,
  });

  if (!result.ok) {
    if (result.error.kind === 'slug_taken') {
      return fail('conflict', `You already have a repo named "${parsed.data.slug}".`);
    }
    return fail('invalid_input', result.error.message);
  }

  return ok({ repo: result.repo }, 201);
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const repos = await listOwnedRepos(auth.supabase, auth.user.id);
  return ok({ repos });
}
