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
  // NOTE: deliberately NOT `{ upsert: true }`.
  //
  // Upsert looks like the tidy fix for the drift described in
  // upload-dropzone.tsx (object present, `blobs` row absent), and it is safe
  // in principle because the path is the content hash. But it turns the write
  // into an UPDATE on storage.objects, and 0004_storage_policies.sql grants
  // INSERT only — so it fails live with "new row violates row-level security
  // policy". Verified against this project, not assumed.
  //
  // Adding an UPDATE policy would mean another hand-applied migration to buy
  // nothing the client-side tolerance does not already handle. The 409 is
  // absorbed in upload-dropzone.tsx instead; see the comment there.
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    // Signing — not the PUT — is what fails when the object is already in the
    // bucket, because a signed upload URL without upsert refuses an occupied
    // path. That makes this the real fix site; tolerating the 409 at upload
    // time never runs, because we never get a URL to upload to.
    //
    // Safe to treat as already-present: the path is the content hash, so an
    // object at blobs/<sha256> holds exactly these bytes. The caller then
    // skips straight to staging, which recreates the missing `blobs` row.
    //
    // Reachable in normal use: the browser PUTs to storage and only then calls
    // /stage. A failed stage (dropped connection, transient error) leaves an
    // object with no row, and since `alreadyExists` above is answered from the
    // table, those exact bytes would otherwise become permanently
    // un-uploadable for every user of the instance.
    if (error && /already exists|duplicate|resource already/i.test(error.message)) {
      return { kind: 'already_exists' };
    }
    return { kind: 'error', message: error?.message ?? 'Failed to create signed upload URL.' };
  }

  return { kind: 'signed', signedUrl: data.signedUrl, token: data.token, path: data.path };
}
