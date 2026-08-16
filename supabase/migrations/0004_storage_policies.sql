-- Vector Vault — T1.2 storage.objects RLS policies for the `designs` bucket.
--
-- The `designs` bucket exists (created by hand per supabase/APPLY.md) and is
-- private, but a private bucket with zero storage.objects policies denies
-- EVERY operation, including the signed-upload-URL creation itself: calling
-- storage.createSignedUploadUrl() as an authenticated user fails with
-- "new row violates row-level security policy" because it needs INSERT
-- permission on storage.objects to reserve the placeholder row. This was
-- discovered live against the deployed project while building T1.2 — the
-- bucket's own file_size_limit/public flags were already correct, only the
-- object-level policies were missing.
--
-- Blobs are content-addressed and immutable (ARCHITECTURE.md §7 / PLAN.md
-- §4: "never re-encode, never delete a blob"), so the policy set is
-- deliberately narrow: any authenticated user may INSERT and SELECT objects
-- in this bucket (mirrors the `blobs` / `blob_metrics` table policies in
-- 0003_rls.sql, which are also readable-by-any-authenticated-user and
-- insertable-only-via-authenticated-sessions). No UPDATE, no DELETE — a
-- blob's storage object should never be overwritten or removed once
-- written. Upload retries after a failed PUT reuse the same signed URL
-- rather than needing UPDATE.
--
-- Idempotent: policies are dropped before being recreated. Apply after
-- 0003_rls.sql, in the Supabase dashboard SQL Editor, same as the others.
-- See supabase/APPLY.md.

drop policy if exists "designs_authenticated_insert" on storage.objects;
drop policy if exists "designs_authenticated_select" on storage.objects;

create policy "designs_authenticated_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'designs');

create policy "designs_authenticated_select"
on storage.objects for select
to authenticated
using (bucket_id = 'designs');
