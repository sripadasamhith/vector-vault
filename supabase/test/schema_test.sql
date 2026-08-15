-- Vector Vault — SQL test suite.
--
-- Runs the real migrations against a throwaway Postgres and asserts the two
-- things that cannot be checked by reading the SQL:
--   1. RLS actually isolates users (the Phase 0 exit condition)
--   2. create_commit() actually produces correct commits
--
-- Both of these shipped broken once and looked fine on inspection:
--   * the original policies recursed ("infinite recursion detected in policy")
--   * create_commit's OUT params collided with column names ("ambiguous")
-- Neither failure appears at DDL time — both apply cleanly and fail on first
-- use. That is exactly why this file exists. Run: npm run verify:sql
--
-- Supabase grants public tables to authenticated via default privileges;
-- replicate that here so we test RLS, not missing grants.
grant all on all tables in schema public to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com')
on conflict do nothing;

\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set R 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '== user A creates a repo =='
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false) \gset _
insert into repos (id, owner_id, slug, name) values (:'R', :'A', 'bracket', 'Bracket');
insert into repo_members (repo_id, user_id, role) values (:'R', :'A', 'owner');
insert into branches (repo_id, name, head_id) values (:'R', 'main', null);

select vv_assert((select count(*) from repos) = 1, 'A sees own repo') \gset _
select vv_assert((select count(*) from branches) = 1, 'A sees own branch') \gset _
select vv_assert((select count(*) from repo_members) = 1, 'A sees own membership') \gset _

\echo ''
\echo '== THE GATE: user B must see nothing of A =='
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false) \gset _

select vv_assert((select count(*) from repos) = 0, 'B cannot see A repo') \gset _
select vv_assert((select count(*) from branches) = 0, 'B cannot see A branch') \gset _
select vv_assert((select count(*) from repo_members) = 0, 'B cannot see A membership') \gset _
select vv_assert((select count(*) from commits) = 0, 'B cannot see A commits') \gset _

select vv_assert_blocked(
  $$insert into commits (id, repo_id, short_sha, message, author_id)
    values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'deadbee', 'x',
            '22222222-2222-2222-2222-222222222222')$$,
  'B cannot write a commit into A repo') \gset _

select vv_assert_blocked(
  $$insert into repos (owner_id, slug, name)
    values ('11111111-1111-1111-1111-111111111111', 'stolen', 'Stolen')$$,
  'B cannot create a repo owned by A') \gset _

\echo ''
\echo '== public visibility grants READ but never WRITE =='
reset role;
update repos set visibility = 'public' where slug = 'bracket';
set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false) \gset _
select vv_assert((select count(*) from repos) = 1, 'B sees public repo') \gset _
select vv_assert_blocked(
  $$insert into branches (repo_id, name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'sneaky')$$,
  'B cannot write to a public repo') \gset _

\echo ''
\echo '== reader membership grants READ but never WRITE =='
reset role;
update repos set visibility = 'private' where slug = 'bracket';
insert into repo_members (repo_id, user_id, role) values (:'R', :'B', 'reader')
on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false) \gset _
select vv_assert((select count(*) from repos) = 1, 'reader sees repo') \gset _
select vv_assert_blocked(
  $$insert into branches (repo_id, name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'reader-branch')$$,
  'reader cannot write') \gset _

reset role;
delete from repo_members where user_id = :'B';

\echo ''
\echo '== create_commit: root commit =='
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false) \gset _
insert into blobs (sha256, storage_path, size_bytes)
values ('sha_cube', 'blobs/sha_cube', 684), ('sha_v2', 'blobs/sha_v2', 684)
on conflict do nothing;
insert into staged_files (repo_id, user_id, branch, path, sha256)
values (:'R', :'A', 'main', 'cube.stl', 'sha_cube');

select create_commit(:'R', 'main', 'initial', :'A') \gset _
select vv_assert((select head_id is not null from branches where name = 'main'),
  'branch head advanced') \gset _
select vv_assert((select count(*) from staged_files) = 0, 'staging cleared') \gset _
select vv_assert((select string_agg(path, ',') from commit_files) = 'cube.stl',
  'commit_files holds the snapshot') \gset _

\echo ''
\echo '== create_commit: refuses empty and no-op commits =='
select vv_assert_blocked(
  $$select create_commit('aaaaaaaa-0000-0000-0000-000000000001','main','empty',
                         '11111111-1111-1111-1111-111111111111')$$,
  'empty staging area is refused') \gset _
select vv_assert((select count(*) from commits) = 1, 'no commit row was created') \gset _

\echo ''
\echo '== create_commit: second commit links to parent =='
insert into staged_files (repo_id, user_id, branch, path, sha256)
values (:'R', :'A', 'main', 'cube.stl', 'sha_v2');
select create_commit(:'R', 'main', 'v2', :'A') \gset _
select vv_assert((select count(*) from commits) = 2, 'two commits exist') \gset _
select vv_assert((select count(parent_id) from commits) = 1, 'second commit has a parent') \gset _

\echo ''
\echo '== create_commit: a staged deletion drops the path =='
insert into staged_files (repo_id, user_id, branch, path, sha256)
values (:'R', :'A', 'main', 'cube.stl', null);
select create_commit(:'R', 'main', 'remove cube', :'A') \gset _
select vv_assert(
  (select count(*) from commit_files cf
     join branches b on b.head_id = cf.commit_id where b.name = 'main') = 0,
  'file removed at head') \gset _

\echo ''
\echo '== create_commit: staging a no-op change is refused =='
insert into staged_files (repo_id, user_id, branch, path, sha256)
values (:'R', :'A', 'main', 'ghost.stl', null);
select vv_assert_blocked(
  $$select create_commit('aaaaaaaa-0000-0000-0000-000000000001','main','noop',
                         '11111111-1111-1111-1111-111111111111')$$,
  'no-op commit is refused') \gset _
select vv_assert((select count(*) from commits) = 3, 'still three commits') \gset _

reset role;
\echo ''
\echo 'ALL SQL ASSERTIONS PASSED'
