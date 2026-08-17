// lib/domain/** owns query logic (ARCHITECTURE.md §2). T2.5: reading a blob
// back out — a short-lived signed download URL, and the format recorded at
// stage time (T2.6, used by the viewer to phrase an honest "preview
// unavailable" message without re-parsing on the server, which lib/mesh/**
// is not allowed to do — ARCHITECTURE.md §2 keeps it network/DB-free).
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'designs';
const SIGNED_URL_TTL_SECONDS = 5 * 60;

export type GetBlobDownloadUrlResult = { ok: true; url: string } | { ok: false; message: string };

/**
 * GET /api/blobs/:sha256/url (ARCHITECTURE.md §1). `blobs` is readable by
 * any authenticated user (ARCHITECTURE.md §6) via RLS, so a caller's
 * user-scoped client either sees the row or it genuinely does not exist —
 * there is no separate "exists but you can't see it" case here the way
 * there is for repos.
 */
export async function getBlobDownloadUrl(
  supabase: SupabaseClient,
  sha256: string
): Promise<GetBlobDownloadUrlResult> {
  const { data: blob, error: lookupError } = await supabase
    .from('blobs')
    .select('storage_path')
    .eq('sha256', sha256)
    .maybeSingle();

  if (lookupError) return { ok: false, message: lookupError.message };
  if (!blob) return { ok: false, message: 'Blob not found.' };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(blob.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return { ok: false, message: error?.message ?? 'Failed to create signed download URL.' };
  }

  return { ok: true, url: data.signedUrl };
}
