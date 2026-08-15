-- Vector Vault — T0.4 row-level security (ARCHITECTURE.md §6).
--
-- Two independent access paths, kept independent:
--   * Authenticated path: every policy below. A repo is readable by its
--     owner, a repo_members row, or when visibility = 'public'. Writes
--     require owner or writer.
--   * Share path: NOT modeled here. share_links rows are only ever read
--     through the service-role client in app/api/shared/[token]/route.ts.
--     There is deliberately no policy here that lets an anon/authenticated
--     request read a share_links row by token — that would duplicate the
--     share-resolution logic in a second, weaker place. Do not add one.
--
-- Idempotent: policies are dropped before being recreated, so this is safe
-- to re-run. Apply after 0001_init.sql. See supabase/APPLY.md.

-- ---------------------------------------------------------------------
-- repos
-- ---------------------------------------------------------------------
alter table repos enable row level security;

drop policy if exists repos_select on repos;
create policy repos_select on repos for select
  to authenticated
  using (
    owner_id = auth.uid()
    or visibility = 'public'
    or exists (
      select 1 from repo_members m
      where m.repo_id = repos.id and m.user_id = auth.uid()
    )
  );

drop policy if exists repos_insert on repos;
create policy repos_insert on repos for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists repos_update on repos;
create policy repos_update on repos for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists repos_delete on repos;
create policy repos_delete on repos for delete
  to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- repo_members
-- ---------------------------------------------------------------------
alter table repo_members enable row level security;

drop policy if exists repo_members_select on repo_members;
create policy repo_members_select on repo_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from repos r
      where r.id = repo_members.repo_id and r.owner_id = auth.uid()
    )
    or exists (
      select 1 from repo_members m2
      where m2.repo_id = repo_members.repo_id and m2.user_id = auth.uid()
    )
  );

-- Owner-only membership management. This also covers the initial 'owner'
-- row a repo-create call inserts for itself, since repos.owner_id is set
-- to auth.uid() by the preceding repos insert.
drop policy if exists repo_members_insert on repo_members;
create policy repo_members_insert on repo_members for insert
  to authenticated
  with check (
    exists (
      select 1 from repos r
      where r.id = repo_members.repo_id and r.owner_id = auth.uid()
    )
  );

drop policy if exists repo_members_update on repo_members;
create policy repo_members_update on repo_members for update
  to authenticated
  using (
    exists (
      select 1 from repos r
      where r.id = repo_members.repo_id and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from repos r
      where r.id = repo_members.repo_id and r.owner_id = auth.uid()
    )
  );

drop policy if exists repo_members_delete on repo_members;
create policy repo_members_delete on repo_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from repos r
      where r.id = repo_members.repo_id and r.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------
alter table branches enable row level security;

drop policy if exists branches_select on branches;
create policy branches_select on branches for select
  to authenticated
  using (
    exists (
      select 1 from repos r
      where r.id = branches.repo_id
        and (
          r.owner_id = auth.uid()
          or r.visibility = 'public'
          or exists (select 1 from repo_members m where m.repo_id = r.id and m.user_id = auth.uid())
        )
    )
  );

drop policy if exists branches_write on branches;
create policy branches_write on branches for all
  to authenticated
  using (
    exists (
      select 1 from repos r
      where r.id = branches.repo_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from repo_members m
            where m.repo_id = r.id and m.user_id = auth.uid() and m.role in ('owner', 'writer')
          )
        )
    )
  )
  with check (
    exists (
      select 1 from repos r
      where r.id = branches.repo_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from repo_members m
            where m.repo_id = r.id and m.user_id = auth.uid() and m.role in ('owner', 'writer')
          )
        )
    )
  );

-- ---------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------
alter table tags enable row level security;

drop policy if exists tags_select on tags;
create policy tags_select on tags for select
  to authenticated
  using (
    exists (
      select 1 from repos r
      where r.id = tags.repo_id
        and (
          r.owner_id = auth.uid()
          or r.visibility = 'public'
          or exists (select 1 from repo_members m where m.repo_id = r.id and m.user_id = auth.uid())
        )
    )
  );

drop policy if exists tags_write on tags;
create policy tags_write on tags for all
  to authenticated
  using (
    exists (
      select 1 from repos r
      where r.id = tags.repo_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from repo_members m
            where m.repo_id = r.id and m.user_id = auth.uid() and m.role in ('owner', 'writer')
          )
        )
    )
  )
  with check (
    exists (
      select 1 from repos r
      where r.id = tags.repo_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from repo_members m
            where m.repo_id = r.id and m.user_id = auth.uid() and m.role in ('owner', 'writer')
          )
        )
    )
  );

-- ---------------------------------------------------------------------
-- commits
-- ---------------------------------------------------------------------
alter table commits enable row level security;

drop policy if exists commits_select on commits;
create policy commits_select on commits for select
  to authenticated
  using (
    exists (
      select 1 from repos r
      where r.id = commits.repo_id
        and (
          r.owner_id = auth.uid()
          or r.visibility = 'public'
          or exists (select 1 from repo_members m where m.repo_id = r.id and m.user_id = auth.uid())
        )
    )
  );

-- Inserted only from inside create_commit() (SECURITY INVOKER), so this
-- still needs to allow write-access users through.
drop policy if exists commits_insert on commits;
create policy commits_insert on commits for insert
  to authenticated
  with check (
    exists (
      select 1 from repos r
      where r.id = commits.repo_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from repo_members m
            where m.repo_id = r.id and m.user_id = auth.uid() and m.role in ('owner', 'writer')
          )
        )
    )
  );

-- No update/delete policy: commits are immutable. Repo deletion cascades
-- via the foreign key, which is not subject to RLS.

-- ---------------------------------------------------------------------
-- commit_files
-- ---------------------------------------------------------------------
alter table commit_files enable row level security;

drop policy if exists commit_files_select on commit_files;
create policy commit_files_select on commit_files for select
  to authenticated
  using (
    exists (
      select 1 from commits c
      join repos r on r.id = c.repo_id
      where c.id = commit_files.commit_id
        and (
          r.owner_id = auth.uid()
          or r.visibility = 'public'
          or exists (select 1 from repo_members m where m.repo_id = r.id and m.user_id = auth.uid())
        )
    )
  );

drop policy if exists commit_files_insert on commit_files;
create policy commit_files_insert on commit_files for insert
  to authenticated
  with check (
    exists (
      select 1 from commits c
      join repos r on r.id = c.repo_id
      where c.id = commit_files.commit_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from repo_members m
            where m.repo_id = r.id and m.user_id = auth.uid() and m.role in ('owner', 'writer')
          )
        )
    )
  );

-- ---------------------------------------------------------------------
-- staged_files — per user, per branch
-- ---------------------------------------------------------------------
alter table staged_files enable row level security;

drop policy if exists staged_files_all on staged_files;
create policy staged_files_all on staged_files for all
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from repos r
      where r.id = staged_files.repo_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from repo_members m
            where m.repo_id = r.id and m.user_id = auth.uid() and m.role in ('owner', 'writer')
          )
        )
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from repos r
      where r.id = staged_files.repo_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from repo_members m
            where m.repo_id = r.id and m.user_id = auth.uid() and m.role in ('owner', 'writer')
          )
        )
    )
  );

-- ---------------------------------------------------------------------
-- blobs / blob_metrics — content-addressed, no ownership. Any
-- authenticated user may read or insert; nobody may update or delete.
-- ---------------------------------------------------------------------
alter table blobs enable row level security;

drop policy if exists blobs_select on blobs;
create policy blobs_select on blobs for select
  to authenticated
  using (true);

drop policy if exists blobs_insert on blobs;
create policy blobs_insert on blobs for insert
  to authenticated
  with check (true);

alter table blob_metrics enable row level security;

drop policy if exists blob_metrics_select on blob_metrics;
create policy blob_metrics_select on blob_metrics for select
  to authenticated
  using (true);

drop policy if exists blob_metrics_insert on blob_metrics;
create policy blob_metrics_insert on blob_metrics for insert
  to authenticated
  with check (true);

-- ---------------------------------------------------------------------
-- share_links — owner-only management. Resolution by token happens only
-- through the service-role route, which bypasses RLS entirely. There is
-- intentionally no policy here that permits lookup by token.
-- ---------------------------------------------------------------------
alter table share_links enable row level security;

drop policy if exists share_links_select on share_links;
create policy share_links_select on share_links for select
  to authenticated
  using (
    exists (
      select 1 from repos r
      where r.id = share_links.repo_id and r.owner_id = auth.uid()
    )
  );

drop policy if exists share_links_insert on share_links;
create policy share_links_insert on share_links for insert
  to authenticated
  with check (
    exists (
      select 1 from repos r
      where r.id = share_links.repo_id and r.owner_id = auth.uid()
    )
  );

drop policy if exists share_links_delete on share_links;
create policy share_links_delete on share_links for delete
  to authenticated
  using (
    exists (
      select 1 from repos r
      where r.id = share_links.repo_id and r.owner_id = auth.uid()
    )
  );
