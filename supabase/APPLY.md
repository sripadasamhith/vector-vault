# Applying migrations — do this by hand

The Supabase CLI is not installed in this environment and there is no DB password or access
token available, so these files cannot be applied automatically. A human has to paste them
into the dashboard. All three files are idempotent (`create table if not exists`, `drop
policy/function if exists` before create), so re-running any of them is safe if something
goes wrong partway.

## These have been tested

Run `npm run verify:sql` (needs Docker) to apply all three to a throwaway Postgres and
assert that RLS isolates users and `create_commit()` behaves. 21 assertions, all passing.

Worth knowing why that exists: two bugs in these files applied *cleanly* and failed only on
first use, so "Success. No rows returned." in the SQL Editor would not have caught either.

1. The original policies queried `repo_members` inside a policy on `repo_members`, and
   `repos` inside a policy that `repo_members` referenced back. Every query against either
   table died with `infinite recursion detected in policy`. Fixed with the SECURITY DEFINER
   helpers at the top of `0003_rls.sql` — read the comment there before editing policies.
2. `create_commit()` declares OUT params named `commit_id` and `short_sha`, which collided
   with the identically-named columns. Every call failed with `column reference is
   ambiguous`. Fixed by alias-qualifying those references.

If you change either file, re-run `npm run verify:sql` before pasting it into the dashboard.

## Steps

1. Open the Supabase dashboard for this project → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/migrations/0001_init.sql`, click **Run**.
   - **Expect:** "Success. No rows returned." Ten tables now exist: `blobs`, `blob_metrics`,
     `repos`, `commits`, `commit_files`, `branches`, `tags`, `staged_files`, `share_links`,
     `repo_members`.
   - Sanity check afterward, in a new query:
     ```sql
     select table_name from information_schema.tables
     where table_schema = 'public' order by 1;
     ```
     should list all ten.
3. New query. Paste all of `supabase/migrations/0003_rls.sql`, click **Run**.
   - **Expect:** "Success. No rows returned." RLS is now enabled on every table above.
   - **Run this before 0002** — the `create_commit()` function inserts into RLS-protected
     tables, and it's safer to have the policies in place before anyone can call it.
   - Sanity check:
     ```sql
     select tablename, rowsecurity from pg_tables
     where schemaname = 'public' order by 1;
     ```
     `rowsecurity` should be `true` for all ten.
4. New query. Paste all of `supabase/migrations/0002_create_commit.sql`, click **Run**.
   - **Expect:** "Success. No rows returned." A function `create_commit(uuid, text, text,
     uuid)` now exists.
   - Sanity check:
     ```sql
     select proname, pronargs from pg_proc where proname = 'create_commit';
     ```
     should return one row with `pronargs = 4`.
   - **RE-APPLY REQUIRED if you applied this file before 2026-08-16.** The version
     originally applied cleared its working temp table with `delete from _cc_new_files;`
     (no WHERE clause). This project's Postgres rejects unqualified DELETEs with
     `"DELETE requires a WHERE clause"` — a guard the original smoke test (probing
     `create_commit()` with a nonexistent branch, expecting `P0002`) never reached,
     because that path raises before the first temp-table clear. **Every real commit
     hits it and fails.** Confirmed live while building T1.5: staging a file and calling
     `POST /api/repos/:id/commits` returned `400 {"error":{"message":"DELETE requires a
     WHERE clause"}}`, and zero rows were written to `commits`. Fixed by switching all
     three clears to `truncate _cc_new_files;` — re-running this file (`create or
     replace`, safe) picks up the fix with no signature change. **This is the single
     highest-priority manual step outstanding** — nothing in Phase 1 that commits can be
     demoed until it's re-applied.
5. Create the `designs` Storage bucket (T1.2, not this task, but do it now if convenient):
   dashboard → **Storage** → **New bucket** → name `designs`, **private**, file size limit
   500 MB. Not required for `verify:phase0` to pass, since that script only exercises
   `repos`/`commits`/RLS.
6. New query. Paste all of `supabase/migrations/0004_storage_policies.sql`, click **Run**.
   - **Expect:** "Success. No rows returned." Two policies now exist on `storage.objects`
     scoped to `bucket_id = 'designs'`.
   - **Required before T1.2/T1.3 work.** Without this, `storage.createSignedUploadUrl()`
     fails for every authenticated user with `"new row violates row-level security policy"`
     — a private bucket with zero object policies denies inserts outright, verified live
     against this project. Confirmed independently: signing in as a real user and calling
     `POST /storage/v1/object/upload/sign/designs/<path>` returned
     `403 {"error":"Unauthorized","message":"new row violates row-level security policy"}`
     before this migration existed.
   - Sanity check:
     ```sql
     select policyname, cmd from pg_policies
     where schemaname = 'storage' and tablename = 'objects';
     ```
     should list `designs_authenticated_insert` (INSERT) and `designs_authenticated_select`
     (SELECT).

## After applying

Run `npm run verify:phase0` from the repo root. It creates two throwaway users, asserts one
cannot see or write into the other's repo, and deletes both users on the way out. It is the
actual Phase 0 exit gate — see `BUILD.md`.

If it fails with a Postgres error mentioning a missing table or function, one of the three
files above didn't get applied — re-run it (safe, idempotent) and try again.
