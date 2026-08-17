// T2.5 (BUILD.md) / ARCHITECTURE.md §1. Signed download URL for a
// content-addressed blob. `blobs` is readable by any authenticated user
// (ARCHITECTURE.md §6), so this only needs requireUser(), not a repo role —
// the route doesn't even know which repo the caller is browsing.
import { fail, ok } from '@/lib/api/envelope';
import { requireUser } from '@/lib/api/guard';
import { getBlobDownloadUrl } from '@/lib/domain/blobs';

const SHA256_RE = /^[0-9a-f]{64}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sha256: string }> }
) {
  const { sha256 } = await params;
  if (!SHA256_RE.test(sha256)) {
    return fail('invalid_input', 'sha256 must be 64 lowercase hex characters');
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const result = await getBlobDownloadUrl(auth.supabase, sha256);
  if (!result.ok) {
    return fail('not_found', result.message);
  }

  return ok({ url: result.url });
}
