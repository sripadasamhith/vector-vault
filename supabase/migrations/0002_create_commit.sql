-- Vector Vault — commit RPC (ARCHITECTURE.md §5).
-- All five steps happen inside this single function call, which Postgres
-- treats as one implicit transaction: if any step raises, everything the
-- function did is rolled back automatically. Runs SECURITY INVOKER (the
-- default) so table RLS still applies to the calling user — a reader with
-- no write access gets blocked by policy, not by application logic.
--
-- Apply in the Supabase dashboard SQL Editor, after 0001_init.sql and after
-- 0003_rls.sql's policies exist (order doesn't strictly matter for the
-- function to be *created*, but it needs RLS in place to be safe to *call*).
-- See supabase/APPLY.md.

drop function if exists create_commit(uuid, text, text, uuid);

create or replace function create_commit(
  p_repo_id uuid,
  p_branch text,
  p_message text,
  p_author uuid
) returns table (commit_id uuid, short_sha text)
language plpgsql
as $$
declare
  v_head_id uuid;
  v_new_commit_id uuid := gen_random_uuid();
  v_staged_count int;
  v_identical boolean;
  v_sorted_pairs text;
  v_base_hash text;
  v_short_sha text;
  v_suffix int := 0;
  v_now timestamptz := now();
begin
  -- Lock the branch row so two concurrent commits on the same branch
  -- serialize instead of racing on branches.head_id.
  select head_id into v_head_id
  from branches
  where repo_id = p_repo_id and name = p_branch
  for update;

  if not found then
    raise exception 'branch % does not exist for repo %', p_branch, p_repo_id
      using errcode = 'P0002';
  end if;

  select count(*) into v_staged_count
  from staged_files
  where repo_id = p_repo_id and user_id = p_author and branch = p_branch;

  if v_staged_count = 0 then
    raise exception 'nothing_staged';
  end if;

  -- Step 1+2: parent's file set with staged rows applied.
  -- sha256 present on the staged side -> upsert path; sha256 null -> drop it.
  create temporary table if not exists _cc_new_files (
    path text primary key,
    sha256 text
  ) on commit drop;
  delete from _cc_new_files;

  -- NOTE: every reference to commit_files.commit_id and commits.short_sha
  -- below MUST be alias-qualified. This function's RETURNS TABLE declares
  -- OUT parameters named commit_id and short_sha, which otherwise collide
  -- with those columns and fail at runtime with
  -- "column reference ... is ambiguous". Do not un-qualify them.
  insert into _cc_new_files (path, sha256)
  select
    coalesce(s.path, p.path) as path,
    case when s.path is not null then s.sha256 else p.sha256 end as sha256
  from (
    select cf.path, cf.sha256 from commit_files cf where cf.commit_id = v_head_id
  ) p
  full outer join (
    select path, sha256 from staged_files
    where repo_id = p_repo_id and user_id = p_author and branch = p_branch
  ) s on s.path = p.path
  where not (s.path is not null and s.sha256 is null);

  -- Step 3: refuse if the resulting set is byte-identical to the parent's.
  select not exists (
    (select path, sha256 from _cc_new_files
     except
     select cf.path, cf.sha256 from commit_files cf where cf.commit_id = v_head_id)
    union
    (select cf.path, cf.sha256 from commit_files cf where cf.commit_id = v_head_id
     except
     select path, sha256 from _cc_new_files)
  ) into v_identical;

  if v_identical then
    delete from _cc_new_files;
    raise exception 'nothing_staged';
  end if;

  -- Step 4: short_sha = first 7 hex of sha256(parentId ?? '' + message +
  -- sortedPathShaPairs + isoTimestamp), retry with a counter on collision.
  select string_agg(path || ':' || coalesce(sha256, ''), ',' order by path)
    into v_sorted_pairs
  from _cc_new_files;

  v_base_hash := encode(
    digest(
      coalesce(v_head_id::text, '') || p_message || coalesce(v_sorted_pairs, '') || v_now::text,
      'sha256'
    ),
    'hex'
  );
  v_short_sha := substr(v_base_hash, 1, 7);

  while exists (select 1 from commits c where c.repo_id = p_repo_id and c.short_sha = v_short_sha) loop
    v_suffix := v_suffix + 1;
    v_short_sha := substr(v_base_hash, 1, 7) || v_suffix::text;
  end loop;

  -- Step 5: insert commit + commit_files, advance branch head, clear staging.
  insert into commits (id, repo_id, parent_id, short_sha, message, author_id)
  values (v_new_commit_id, p_repo_id, v_head_id, v_short_sha, p_message, p_author);

  insert into commit_files (commit_id, path, sha256)
  select v_new_commit_id, path, sha256 from _cc_new_files;

  update branches set head_id = v_new_commit_id
  where repo_id = p_repo_id and name = p_branch;

  delete from staged_files
  where repo_id = p_repo_id and user_id = p_author and branch = p_branch;

  delete from _cc_new_files;

  return query select v_new_commit_id, v_short_sha;
end;
$$;
