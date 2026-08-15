# Vector Vault — v1 Build Plan

**Audience:** an implementing agent (Claude Sonnet) with repo write access.
**Goal:** a deployable Next.js app on Vercel where a user uploads CAD files from *any* tool,
versions them, drives them with git-style commands, and shares a read-only link.

Read `kb/AGENTS.md` and `kb/wiki/overview.md` before starting. This plan is downstream of the
wiki; where they conflict, the wiki wins and this plan is wrong.

---

## 1. Constraints that come from the research

These are not preferences. Each one is load-bearing and traceable to a wiki page. Violating
one silently is the main way this build fails.

| # | Constraint | Source |
|---|---|---|
| C1 | **Never require a CAD tool switch.** Accept whatever file the user already exports. Unknown formats must still store, version, and share — they just get fewer features. | `what-should-we-build-first` |
| C2 | **Store the original byte-for-byte and immutably.** Content-address it. Never re-encode, never "normalize on save." | `what-is-the-right-primary-artifact` |
| C3 | **Derived representation is the versioned artifact.** Metrics and previews are computed on ingest and stored alongside; comparison happens over the derived form, never over raw bytes. | `what-is-the-right-primary-artifact` |
| C4 | **Degrade gracefully by format.** STL/OBJ/3MF → full metrics + viewer + diff. STEP/native → store, hash, version, share; show "preview unavailable" honestly. | `neutral-exchange-formats` |
| C5 | **Do not claim merge.** Branches exist; merging geometry does not. A merge attempt on a diverged file must refuse with an explicit "pick a side" resolution, never auto-combine. | `geometry-diffing` (limits) |
| C6 | **Be robust to tessellation noise.** A re-export of an unchanged part has different bytes and different vertices. If byte hash differs but metrics match within tolerance, label it `re-exported, geometry equivalent` — not "changed." | `geometry-diffing` (failure modes) |
| C7 | **Don't oversell the diff.** v1 ships change *signals* and a synced side-by-side viewer. It does not localize changes. Say so in the UI. | `geometry-diffing` (approach 2 vs 3) |

C6 and C7 are the two most likely to get quietly dropped. They are the honest parts.

---

## 2. Scope

**In:** upload (any format), repos, branches, commits, history, checkout, tags, per-file diff
signals, synced dual 3D viewer, share links, in-app command bar.

**Out of v1:** SDF heat-map diff, merge, CLI binary, real-time collaboration, comments/review,
assemblies and file relationships, org accounts.

**Design the REST API as if a CLI will consume it** — stateless, token-authenticated, no
session-only endpoints. The CLI is the obvious v2 and this costs nothing now.

---

## 3. Stack

- **Next.js 15** (App Router, TypeScript, React Server Components where sensible)
- **Supabase** — Postgres (metadata), Storage (blobs), Auth (email magic link + GitHub OAuth)
- **three.js** + `three/examples/jsm/loaders/STLLoader` / `OBJLoader` / `3MFLoader`
- **Tailwind CSS** + shadcn/ui
- **Zod** for API input validation
- Deploy: Vercel, `main` → production

### Critical platform limit

Vercel serverless request bodies cap around 4.5 MB. CAD files routinely exceed that.
**Files must never pass through a Next.js API route.** The flow is:

1. Browser requests a signed upload URL from `/api/uploads/sign`
2. Browser `PUT`s the file directly to Supabase Storage
3. Browser parses the mesh locally (Web Worker), computes metrics
4. Browser `POST`s `{ storage_path, sha256, metrics }` to `/api/repos/:id/commits`

Client-computed metrics are untrusted input. Validate ranges server-side (non-negative,
finite, triangle count sane) and record `metrics_source: 'client'`. Server-side
recomputation is a v2 hardening item — note it in the code, don't build it now.

---

## 4. Data model

Commits store a full file snapshot rather than git-style trees. Less elegant, dramatically
simpler, and correct for repos holding tens of files rather than thousands.

```sql
-- Content-addressed storage. One row per unique file body, ever.
blobs (
  sha256        text primary key,
  storage_path  text not null,          -- Supabase Storage key
  size_bytes    bigint not null,
  created_at    timestamptz default now()
)

-- Derived representation (C3). Null for formats we can't parse (C4).
blob_metrics (
  sha256          text primary key references blobs,
  format          text not null,        -- stl | obj | 3mf | step | unknown
  triangle_count  integer,
  volume_mm3      double precision,
  surface_area_mm2 double precision,
  bbox            jsonb,                -- {min:[x,y,z], max:[x,y,z]}
  centroid        jsonb,                -- [x,y,z]
  is_watertight   boolean,
  metrics_source  text default 'client',
  computed_at     timestamptz default now()
)

repos (
  id            uuid primary key,
  owner_id      uuid references auth.users,
  slug          text not null,          -- unique per owner
  name          text not null,
  description   text,
  visibility    text default 'private', -- private | link | public
  default_branch text default 'main',
  created_at    timestamptz default now(),
  unique (owner_id, slug)
)

commits (
  id          uuid primary key,
  repo_id     uuid references repos on delete cascade,
  parent_id   uuid references commits,  -- null = root commit
  short_sha   text not null,            -- first 7 of a content hash, unique per repo
  message     text not null,
  author_id   uuid references auth.users,
  created_at  timestamptz default now(),
  unique (repo_id, short_sha)
)

-- Full snapshot: every file present at this commit.
commit_files (
  commit_id   uuid references commits on delete cascade,
  path        text not null,            -- 'bracket.stl', 'housing/lid.step'
  sha256      text references blobs,
  primary key (commit_id, path)
)

branches (
  repo_id     uuid references repos on delete cascade,
  name        text not null,
  head_id     uuid references commits,
  created_at  timestamptz default now(),
  primary key (repo_id, name)
)

tags (
  repo_id     uuid references repos on delete cascade,
  name        text not null,            -- 'v1.0', 'sent-to-machinist'
  commit_id   uuid references commits,
  note        text,
  primary key (repo_id, name)
)

-- Staging: uploaded but not yet committed. Per user, per branch.
staged_files (
  repo_id     uuid references repos on delete cascade,
  user_id     uuid references auth.users,
  branch      text not null,
  path        text not null,
  sha256      text references blobs,    -- null = staged deletion
  staged_at   timestamptz default now(),
  primary key (repo_id, user_id, branch, path)
)

share_links (
  token       text primary key,         -- 32-byte base64url
  repo_id     uuid references repos on delete cascade,
  ref         text,                     -- branch, tag, or short_sha; null = default branch
  expires_at  timestamptz,
  created_by  uuid references auth.users,
  created_at  timestamptz default now()
)

repo_members (
  repo_id  uuid references repos on delete cascade,
  user_id  uuid references auth.users,
  role     text not null,               -- owner | writer | reader
  primary key (repo_id, user_id)
)
```

**Enable RLS on every table.** Policies: a user can read a repo if they own it, are a member,
or it is `public`; write requires `owner` or `writer`. Share-link access bypasses RLS through
a service-role read path in a single dedicated server route — never by loosening a policy.

Blobs are global and deduplicated. **Never delete a blob when a commit is deleted** — another
commit may reference it. Garbage collection is out of scope.

---

## 5. Mesh parsing and metrics

Implement in `lib/mesh/` as pure functions over `ArrayBuffer`. Run inside a Web Worker so
large files don't freeze the UI.

- `parseSTL` — detect binary vs ASCII (don't trust the `solid` prefix; check whether
  `84 + 50 * triangleCount === byteLength`)
- `parseOBJ`, `parse3MF` — via three.js loaders
- `computeMetrics(geometry)`:
  - `volume` — signed tetrahedron sum over triangles: `Σ (v0 · (v1 × v2)) / 6`. Absolute value.
    Only meaningful if watertight; return null with `is_watertight: false` otherwise.
  - `surface_area` — sum of triangle areas
  - `bbox`, `centroid` (area-weighted), `triangle_count`
  - `is_watertight` — every edge appears exactly twice with opposite winding
- Units: STL/OBJ carry none. **Assume millimetres, display "mm (assumed)"**, and let the repo
  carry a `units` setting the user can override. Do not silently guess.

### Change classification (C6)

Given two blobs A and B for the same path:

```
sha256 equal                                    → unchanged
sha256 differs, all metrics within tolerance    → re-exported, geometry equivalent
sha256 differs, metrics differ                  → modified
present in B only                               → added
present in A only                               → removed
metrics unavailable (unparseable format)        → binary change (no analysis)
```

Tolerance: relative 0.1% on volume and surface area, absolute 0.01 mm on bbox dimensions.
Put these in one exported `TOLERANCE` constant — they will be tuned against real files.

---

## 6. Commands

A command bar (`⌘K` or always-visible in the repo view) that parses a line and calls the API.
Output renders as a terminal transcript, monospace, scrollback persisted per repo in
`sessionStorage`.

| Command | Behaviour |
|---|---|
| `status` | Staged files, current branch, HEAD short_sha |
| `add <path>` \| `add .` | Stage an already-uploaded file (upload UI stages automatically) |
| `rm <path>` | Stage a deletion |
| `commit -m "<msg>"` | Snapshot: copy HEAD's `commit_files`, apply staged changes, write commit, advance branch head. Refuse on empty staging area. |
| `log [-n N]` | Commit history from HEAD, newest first |
| `show <ref>` | One commit: message, author, date, per-file change list |
| `diff [<refA>] [<refB>]` | Default: HEAD vs working/staged. Renders the change table + opens the dual viewer |
| `branch [<name>]` | List branches, or create one at HEAD |
| `checkout <ref>` | Switch branch, or enter detached view at a commit/tag |
| `tag <name> [<ref>]` | Name a commit |
| `revert <ref>` | New commit restoring that ref's file set. Never rewrites history. |
| `share [<ref>] [--expires 7d]` | Mint a share link, print the URL |
| `ls [<ref>]` | Files at a ref, with size and format |
| `whoami`, `help`, `clear` | Obvious |

Parsing: a small hand-written tokenizer that respects double-quoted strings. Do not pull in a
CLI framework. Unknown command → `vault: '<x>' is not a command. Try 'help'.`

**`merge` must exist and must refuse** (C5):

```
vault> merge feature-a
vault: geometry cannot be merged automatically.
       bracket.stl diverged in both branches.
       Resolve by choosing a side:
         vault checkout feature-a -- bracket.stl
         vault checkout main -- bracket.stl
```

Fast-forward merges (target strictly ahead, no divergence) *are* allowed — that's pointer
movement, not geometry merging.

---

## 7. API surface

All under `/api`, all Zod-validated, all returning `{ data }` or `{ error: { code, message } }`.

```
POST   /api/repos                          create
GET    /api/repos                          list mine
GET    /api/repos/:owner/:slug             detail + branches + HEAD
POST   /api/uploads/sign                   → { signed_url, storage_path }
POST   /api/repos/:id/stage                { path, sha256, size, metrics }
DELETE /api/repos/:id/stage                { path }
POST   /api/repos/:id/commits              { message, branch }
GET    /api/repos/:id/commits              ?branch=&limit=
GET    /api/repos/:id/commits/:ref
GET    /api/repos/:id/diff                 ?a=<ref>&b=<ref>
POST   /api/repos/:id/branches             { name, from }
POST   /api/repos/:id/tags                 { name, ref, note }
POST   /api/repos/:id/revert               { ref }
POST   /api/repos/:id/shares               { ref, expires_in }
GET    /api/shared/:token                  public, no auth
GET    /api/blobs/:sha256/url              → short-lived signed download URL
```

Ref resolution is one shared helper: `resolveRef(repoId, ref)` handling `HEAD`, branch names,
tag names, and short SHAs, in that precedence order.

---

## 8. Pages

```
/                              landing — what this is, honest about what it does not do
/login                         Supabase auth
/dashboard                     repo list + new repo
/[owner]/[repo]                file browser at current ref, command bar, upload dropzone
/[owner]/[repo]/commits        history timeline
/[owner]/[repo]/commit/[sha]   single commit + its change table
/[owner]/[repo]/compare        dual viewer + metric delta table
/[owner]/[repo]/blob/[path]    single-file viewer
/share/[token]                 read-only view, no chrome, no auth
```

### The compare view — the piece that has to feel good

Two `<canvas>` viewers side by side, **cameras locked together** (one `OrbitControls`, applied
to both cameras each frame). Above them, the metric delta table:

```
bracket.stl   9de033 → 4a2f1c

  volume        41.20 cm³ → 40.85 cm³    −0.85%
  surface area  182.4 cm² → 186.1 cm²    +2.03%
  bounding box  80×40×12 → 80×40×12      unchanged
  triangles         4,812 → 5,204        +392
  watertight          yes → yes

  ⓘ Vector Vault reports that geometry changed and by how much.
    It does not yet show where. Rotate both views together to inspect.
```

That info line is required (C7). A toggle for wireframe and one for a 50% opacity overlay of
B on top of A in a single viewport is a cheap addition that helps a lot — include it.

---

## 9. Build phases

Each phase ends deployable and demoable. Do not start a phase before its predecessor's
acceptance criteria pass.

**Phase 0 — foundation**
Next.js + TS + Tailwind scaffold, Supabase project, schema migration, RLS policies, auth,
`/dashboard` with repo create/list. Deployed to Vercel with env vars set.
*Accept:* two different accounts cannot see each other's repos (verify by logging in as both).

**Phase 1 — storage and commits**
Signed-URL upload, blob dedup, staging, `commit`, `log`, `ls`, file browser. Command bar with
`status`/`add`/`commit`/`log`/`ls`/`help`.
*Accept:* upload a 40 MB STEP file successfully (proves the direct-upload path); upload the
same file twice and confirm one `blobs` row.

**Phase 2 — mesh parsing and viewer**
Web Worker parsing, metrics, single-file three.js viewer, format-dependent degradation.
*Accept:* a known cube STL reports correct volume within 0.1%; a `.sldprt` uploads, versions,
and displays "preview unavailable" without erroring.

**Phase 3 — diff**
`diff` command, change classification incl. the re-export case, compare page with synced
cameras and the delta table.
*Accept:* re-export an unchanged part at a different chord tolerance → classified
`re-exported, geometry equivalent`, not `modified`. This test is the point of C6.

**Phase 4 — branches, tags, sharing**
`branch`, `checkout`, `tag`, `revert`, `merge` (refusing + fast-forward), share links,
`/share/[token]`.
*Accept:* a share link opens in a logged-out incognito window and shows exactly the pinned ref;
an expired token 404s.

**Phase 5 — polish**
Landing page, empty states, upload progress, error toasts, mobile layout, `README.md` with
setup steps.

---

## 10. Test files to keep in `fixtures/`

Real coverage matters more than unit-test count here:

- `cube-20mm.stl` (binary) — known volume 8,000 mm³, exact metric check
- `cube-20mm-ascii.stl` — parser branch coverage
- `cube-20mm-refined.stl` — same shape, different tessellation → the C6 test
- `bracket-v1.stl` / `bracket-v2.stl` — a real change, for the diff view
- `open-shell.stl` — non-watertight, volume must return null not garbage
- `part.step`, `part.sldprt` — unparseable path (C4)
- `large.stl` (>50 MB) — proves upload path and worker responsiveness

---

## 11. Environment

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY     # server-only; share-link reads. Never NEXT_PUBLIC_.
NEXT_PUBLIC_APP_URL
```

Supabase Storage bucket `designs`, **private**, with a 500 MB per-object limit.

---

## 12. Known gaps to state in the README, not hide

Taken from the wiki so the product's honesty matches the research:

- No merge. Branch and choose; there is no combining of geometry.
- Diff detects and quantifies change, but does not localize it. SDF heat maps are the next bet.
- Metrics assume millimetres unless the repo says otherwise.
- STEP and native formats get storage, versioning, and sharing — no preview, no diff.
- Metrics are computed client-side in v1 and are not tamper-proof.

---

## 13. When this is done

Update `kb/wiki/log.md` with a `## [YYYY-MM-DD] decision | ...` entry, and open a decision page
in `kb/wiki/decisions/` recording what the build settled about
`what-is-the-right-primary-artifact` — specifically whether the metric-signal diff was legible
enough to be worth anything without the SDF layer. Follow `kb/AGENTS.md` when writing it.
