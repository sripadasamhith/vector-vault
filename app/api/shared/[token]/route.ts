// T4.4 (BUILD.md) — GET /api/shared/:token, public, no auth. THE ONLY FILE
// PERMITTED TO IMPORT lib/supabase/admin.ts (ARCHITECTURE.md §2, §6).
// If a second importer of admin.ts ever appears, the share-link design has
// been misunderstood — stop and re-read ARCHITECTURE.md §6 rather than
// widening access. There is deliberately no RLS policy that would let an
// anonymous/authenticated request read a share_links row by token
// (0003_rls.sql) — the service-role client is the only way to resolve one,
// which is why this route exists and why no other route needs it.
//
// Returns ONLY the pinned ref's file list, metrics, and short-lived signed
// download URLs (lib/domain/shares.ts's resolveShare()) — never other
// branches, other refs, the member list, repo settings, or owner identity.
// Expired tokens 404, same as a token that never existed, so a probing
// request can't distinguish the two.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShare } from '@/lib/domain/shares';
import type { ApiResponse } from '@/lib/api/envelope';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const result = await resolveShare(supabase, token);

  if (!result.ok) {
    // Both "no such token" and "expired" 404 identically — an expired
    // token must not be distinguishable from a never-issued one.
    return NextResponse.json<ApiResponse<never>>(
      { error: { code: 'not_found', message: 'This share link is invalid or has expired.' } },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<{ ref: string; shortSha: string; files: typeof result.share.files }>>({
    data: { ref: result.share.ref, shortSha: result.share.shortSha, files: result.share.files },
  });
}
