// lib/domain/** owns query logic (ARCHITECTURE.md §2). Signed-upload minting
// touches both the `blobs` table (dedup check) and Supabase Storage, so it
// lives here rather than inline in app/api/uploads/sign/route.ts — the route
// parses/validates and delegates, per the layering rule.
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'designs';

/** Mirrors the `designs` bucket's file_size_limit (PLAN.md §11) — checked
 * here so a too-large file gets a clear 400 instead of a confusing storage
 * 413 after the client has already started hashing. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type SignUploadResult =
  | { kind: 'already_exists' }
  | { kind: 'signed'; signedUrl: string; token: string; path: string }
  | { kind: 'error'; message: string };

/**
 * Step 2 of the upload flow (ARCHITECTURE.md §4): given a hash the browser
 * already computed, either report the blob is known (client skips the
 * upload entirely) or mint a signed upload URL at the content-addressed
 * storage path `blobs/<sha256>`.
 */
export async function signUpload(
  supabase: SupabaseClient,
  params: { sha256: string; filename: string; size: number }
): Promise<SignUploadResult> {
  const { data: existing, error: lookupError } = await supabase
    .from('blobs')
    .select('sha256')
    .eq('sha256', params.sha256)
    .maybeSingle();

  if (lookupError) {
    return { kind: 'error', message: lookupError.message };
  }
  if (existing) {
    return { kind: 'already_exists' };
  }

  const path = `blobs/${params.sha256}`;
  // upsert: true is safe *because* the path is the content hash — re-writing
  // blobs/<sha256> can only ever write byte-identical content.
  //
  // It is also necessary. The `blobs` lookup above and the storage object can
  // drift: the browser PUTs to storage and only then calls /stage, so a failed
  // stage call (dropped connection, transient error) leaves an object with no
  // row. Without upsert the next attempt signs a fresh upload, the PUT 409s
  // with "The resource already exists", and those exact bytes become
  // permanently un-uploadable for every user of the instance.
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    return { kind: 'error', message: error?.message ?? 'Failed to create signed upload URL.' };
  }

  return { kind: 'signed', signedUrl: data.signedUrl, token: data.token, path: data.path };
}
