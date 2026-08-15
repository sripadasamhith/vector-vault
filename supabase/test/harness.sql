-- Minimal Supabase-compatible shim so the real migrations run unmodified
-- against a plain Postgres container. NOT applied to production — the real
-- Supabase project already provides auth.users, auth.uid(), and the
-- anon/authenticated roles.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase's auth.uid() reads the JWT sub claim. Here it reads a GUC we set,
-- which lets a test impersonate a user without minting real JWTs.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public, auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

-- Assertion helper: raises (and so fails the run) when cond is false.
create or replace function vv_assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
  raise notice '  ok: %', msg;
end $$;

-- Runs stmt and asserts it is rejected by RLS.
create or replace function vv_assert_blocked(stmt text, msg text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice '  ok: % (blocked: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'ASSERTION FAILED: % — statement was ALLOWED', msg;
end $$;
