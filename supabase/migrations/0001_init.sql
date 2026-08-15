-- Vector Vault — T0.3 initial schema.
-- Every table from PLAN.md §4, verbatim column names. Idempotent: safe to
-- re-run against a project that already has some or all of this applied.
--
-- Apply in the Supabase dashboard SQL Editor. See supabase/APPLY.md.

create extension if not exists pgcrypto;

-- Content-addressed storage. One row per unique file body, ever.
create table if not exists blobs (
  sha256        text primary key,
  storage_path  text not null,          -- Supabase Storage key
  size_bytes    bigint not null,
  created_at    timestamptz default now()
);

-- Derived representation (C3). Null for formats we can't parse (C4).
create table if not exists blob_metrics (
  sha256           text primary key references blobs,
  format           text not null,        -- stl | obj | 3mf | step | unknown
  triangle_count   integer,
  volume_mm3       double precision,
  surface_area_mm2 double precision,
  bbox             jsonb,                -- {min:[x,y,z], max:[x,y,z]}
  centroid         jsonb,                -- [x,y,z]
  is_watertight    boolean,
  metrics_source   text default 'client',
  computed_at      timestamptz default now()
);

create table if not exists repos (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid references auth.users,
  slug           text not null,          -- unique per owner
  name           text not null,
  description    text,
  visibility     text default 'private', -- private | link | public
  default_branch text default 'main',
  created_at     timestamptz default now(),
  unique (owner_id, slug)
);

create table if not exists commits (
  id          uuid primary key default gen_random_uuid(),
  repo_id     uuid references repos on delete cascade,
  parent_id   uuid references commits,  -- null = root commit
  short_sha   text not null,            -- first 7 of a content hash, unique per repo
  message     text not null,
  author_id   uuid references auth.users,
  created_at  timestamptz default now(),
  unique (repo_id, short_sha)
);

-- Full snapshot: every file present at this commit.
create table if not exists commit_files (
  commit_id   uuid references commits on delete cascade,
  path        text not null,            -- 'bracket.stl', 'housing/lid.step'
  sha256      text references blobs,
  primary key (commit_id, path)
);

create table if not exists branches (
  repo_id     uuid references repos on delete cascade,
  name        text not null,
  head_id     uuid references commits,
  created_at  timestamptz default now(),
  primary key (repo_id, name)
);

create table if not exists tags (
  repo_id     uuid references repos on delete cascade,
  name        text not null,            -- 'v1.0', 'sent-to-machinist'
  commit_id   uuid references commits,
  note        text,
  primary key (repo_id, name)
);

-- Staging: uploaded but not yet committed. Per user, per branch.
create table if not exists staged_files (
  repo_id     uuid references repos on delete cascade,
  user_id     uuid references auth.users,
  branch      text not null,
  path        text not null,
  sha256      text references blobs,    -- null = staged deletion
  staged_at   timestamptz default now(),
  primary key (repo_id, user_id, branch, path)
);

create table if not exists share_links (
  token       text primary key,         -- 32-byte base64url
  repo_id     uuid references repos on delete cascade,
  ref         text,                     -- branch, tag, or short_sha; null = default branch
  expires_at  timestamptz,
  created_by  uuid references auth.users,
  created_at  timestamptz default now()
);

create table if not exists repo_members (
  repo_id  uuid references repos on delete cascade,
  user_id  uuid references auth.users,
  role     text not null,               -- owner | writer | reader
  primary key (repo_id, user_id)
);
