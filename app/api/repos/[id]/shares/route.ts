// T4.4 (BUILD.md) — POST /api/repos/:id/shares. Owner-only (PLAN.md §4/
// ARCHITECTURE.md §6: "owner (everything incl. delete and share)"), which
// also matches share_links_insert's RLS policy (0003_rls.sql:
// vv_is_repo_owner). Uses the RLS-scoped client from requireRepoRole, NOT
// lib/supabase/admin.ts — minting a link is an authenticated write, not a
// share read. Parses, validates, and delegates to lib/domain/shares.ts.
import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { mintShare } from '@/lib/domain/shares';

const shareSchema = z.object({
  ref: z.string().min(1).max(255).optional(),
  expiresInSeconds: z.number().int().positive().max(60 * 60 * 24 * 365).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'owner');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = shareSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const result = await mintShare(auth.supabase, {
    repoId,
    ref: parsed.data.ref ?? null,
    expiresInSeconds: parsed.data.expiresInSeconds,
    createdBy: auth.user.id,
  });

  if (!result.ok) {
    return fail('invalid_input', result.message);
  }

  return ok(
    {
      token: result.share.token,
      ref: result.share.ref,
      expiresAt: result.share.expires_at,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/share/${result.share.token}`,
    },
    201
  );
}
