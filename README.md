# Vector Vault

Version control, sharing, and git-style commands for CAD files from any tool.

Upload STL, OBJ, 3MF, STEP, or a native CAD file (e.g. `.sldprt`). Vector Vault
content-addresses it, versions it, and lets you `commit`, `branch`, `diff`, `tag`, `revert`,
and `share` it through a terminal-style command bar in the browser — the same mental model
as git, applied to binary geometry. STL/OBJ/3MF also get a 3D preview and a metric-based
diff signal; every other format still gets storage, versioning, and sharing.

Built as a phased implementation of `PLAN.md`, following the layering in `ARCHITECTURE.md`
and the task order in `BUILD.md`. The product decisions themselves — what a "diff" can
honestly mean for a mesh, why there's no merge, why formats degrade the way they do — are
argued out in `kb/` (see `kb/AGENTS.md` for how that wiki is organized); this README and the
plan documents are downstream of that research, not a substitute for it.

## What this doesn't do (stated on purpose, not hidden)

Taken verbatim from `PLAN.md` §12:

- No merge. Branch and choose; there is no combining of geometry.
- Diff detects and quantifies change, but does not localize it. SDF heat maps are the next bet.
- Metrics assume millimetres unless the repo says otherwise.
- STEP and native formats get storage, versioning, and sharing — no preview, no diff.
- Metrics are computed client-side in v1 and are not tamper-proof.

## Stack

Next.js (App Router, TypeScript) + Supabase (Postgres metadata, Storage for blobs, Auth for
magic-link + GitHub OAuth) + three.js for the viewers. No ORM, no state library, no CLI
parser — see `BUILD.md`'s rules of engagement for why the dependency list stays this short.

## Setup

### 1. Environment variables

Copy `.env.example` to `.env.local` and fill in the four values from Supabase → Settings →
API Keys (`PLAN.md` §11):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY        # server-only, bypasses RLS — never NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL        # where this app runs, used for auth redirects
```

Verify the file is well-formed (without ever printing secret values) with:

```bash
npm run check-env
```

The `designs` Storage bucket must exist and be **private**. The Supabase free plan caps
uploads at 50 MiB per object platform-wide (not the 500 MB originally planned — see
`PLAN.md` §11); a paid plan is a prerequisite for real CAD assemblies, though the free tier
is enough to prove files bypass Vercel's ~4.5 MB serverless body cap, which is the property
that actually matters architecturally.

### 2. Database

Ten tables, RLS-protected, defined in `supabase/migrations/`. The Supabase CLI/DB
credentials aren't available in this environment, so migrations are applied by hand — follow
`supabase/APPLY.md` step by step; it also explains two non-obvious bugs (RLS recursion,
ambiguous `OUT` params in `create_commit()`) that were fixed and are worth reading before you
touch either SQL file.

Before pasting anything into the dashboard, lint and test the SQL locally:

```bash
npm run lint:sql     # static checks on the migration files
npm run verify:sql   # Docker: applies 0001/0003/0002 to a throwaway Postgres,
                      # asserts RLS isolation + create_commit() behaviour (21 assertions)
```

### 3. Install and run

```bash
npm install
npm run dev
```

### 4. Deploy

Vercel, `main` → production. Set the same four env vars in the Vercel project settings.
Files never pass through a Next.js API route (Vercel's ~4.5 MB body cap would break large
CAD files) — the browser uploads straight to Supabase Storage via a signed URL; see
`ARCHITECTURE.md` §4 if you're touching that path.

## Verification

```bash
npm run test              # vitest — unit tests for lib/mesh, lib/commands, lib/domain
npm run build              # next build — type checks + production build
npm run check-env          # .env.local shape, no secrets printed
npm run lint:sql           # static checks on supabase/migrations/*.sql
npm run verify:sql         # Docker: RLS + create_commit() assertions
npm run verify:phase0      # auth/account isolation, deployed or local
npm run verify:phase1      # upload/stage/commit round trip, content addressing
npm run verify:phase2      # mesh parsing, metrics, 3D viewer data path
npm run verify:phase3      # diff signals, re-export classification, compare view
npm run verify:phase4      # branches, tags, revert, merge refusal, share links
```

The `verify:phase*` scripts exercise the real HTTP API against either a local `npm run dev`
server or a deployed URL (`VV_APP_URL=https://your-deployment.example`), using disposable
accounts cleaned up in a `finally` block — they do not require a browser.

## Documentation map

- `PLAN.md` — what to build and why, including the constraints (`§1`) and known gaps (`§12`).
- `ARCHITECTURE.md` — the shapes: the layering rule (`§2`), type contracts (`§3`), and the
  rest of the system design decisions that later tasks depend on.
- `BUILD.md` — the ordered task list, one phase at a time, each with its own verify step and
  the rules of engagement for working through it.
- `kb/` — the research wiki this whole plan is downstream of: prior art on mesh diffing,
  neutral exchange formats, and the domain reasoning behind constraints C1–C7. Read
  `kb/AGENTS.md` first; it's the authority on how the wiki itself is written and maintained.
