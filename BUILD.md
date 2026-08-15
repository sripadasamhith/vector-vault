# Vector Vault — Build Procedure

The ordered task list. `PLAN.md` says what and why; `ARCHITECTURE.md` says what shape;
this file says what to do next.

**Read `ARCHITECTURE.md` in full before task 0.1.** Re-read the section named in each task
before starting it.

---

## Rules of engagement

1. **One task at a time, in order.** Each task ends with a `verify` command. Do not begin the
   next task until the current one's verify passes. Do not batch three tasks into one edit.
2. **Run the verify command. Do not assume it passes.** If it fails, fix it before moving on.
   If it fails twice for the same reason, stop and report rather than trying a third variation.
3. **Commit after every task** with `[T<id>] <summary>`. Small commits make it obvious where a
   regression entered.
4. **Types come from `ARCHITECTURE.md` §3.** Import them; never redeclare a shape inline.
5. **Never break the layering rule** (`ARCHITECTURE.md` §2). If a task appears to require it,
   you have misread the task — stop and ask.
6. **No placeholder implementations.** Do not write `// TODO: compute volume` and return 0. If
   a task cannot be completed, say so explicitly and stop; a stub that silently returns wrong
   numbers is worse than an unfinished build.
7. **Do not add dependencies** beyond §0 without saying why. No CLI-parser library, no state
   library, no ORM.

### Stop and ask when

- Supabase RLS blocks something you expected to work (usually the design is wrong, not the policy)
- A verify step needs a real CAD file that is not in `fixtures/`
- Vercel rejects a deploy for a reason not covered here
- A task's acceptance criterion seems impossible as written

---

## Phase 0 — Foundation

**Exit condition:** two accounts, deployed on Vercel, cannot see each other's repos.

### T0.1 Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*"
npm i @supabase/supabase-js @supabase/ssr zod three
npm i -D @types/three vitest
```

Add to `package.json`: `"test": "vitest run"`.
**verify:** `npm run build` succeeds.

### T0.2 Supabase clients

Create `lib/supabase/{client,server,admin}.ts` per `ARCHITECTURE.md` §2. `admin.ts` must
start with a comment naming its single permitted importer and read
`SUPABASE_SERVICE_ROLE_KEY`. Add `.env.local` with the four vars from `PLAN.md` §11 and
`.env.example` with the same keys, values blank.
**verify:** `grep -rn "SERVICE_ROLE" app/ lib/` returns only `lib/supabase/admin.ts`.

### T0.3 Schema migration

Write `supabase/migrations/0001_init.sql` containing every table from `PLAN.md` §4, verbatim
column names. Apply it to the Supabase project.
**verify:** all ten tables exist; `blobs.sha256` is the primary key; `commit_files` has a
composite PK on `(commit_id, path)`.

### T0.4 RLS policies

Enable RLS on every table. Policies per `ARCHITECTURE.md` §6. `blobs` and `blob_metrics` are
readable by any authenticated user (they are content-addressed and carry no ownership) but
insertable only via authenticated sessions.
**verify:** with RLS on and no policy match, `select * from repos` as an anon key returns 0
rows rather than an error.

### T0.5 Auth

`login/page.tsx` (magic link + GitHub OAuth), `auth/callback/route.ts`, middleware refreshing
the session cookie via `@supabase/ssr`.
**verify:** log in, reload the page, still logged in.

### T0.6 Dashboard

`dashboard/page.tsx` listing the user's repos, plus a create form posting to
`POST /api/repos`. Slug must be unique per owner; validate as `^[a-z0-9][a-z0-9-]{0,38}$`.
Creating a repo also creates the `main` branch row with `head_id = null` and an
`owner` row in `repo_members`.
**verify:** create a repo, see it listed, reload, still listed.

### T0.7 Deploy

Push to GitHub, import to Vercel, set the four env vars, deploy.
**verify (phase gate):** open the production URL in two browsers logged in as two different
accounts. Account A's repo is not visible to account B, and hitting A's repo URL directly as B
returns not-found. **Do not proceed to Phase 1 until this passes.**

---

## Phase 1 — Storage and commits

**Exit condition:** a 40 MB file uploads; uploading it twice creates one `blobs` row.

### T1.1 API envelope and guards

`lib/api/envelope.ts` (`ok()`, `fail()`, types from `ARCHITECTURE.md` §3) and
`lib/api/guard.ts` (`requireUser()`, `requireRepoRole(repoId, min)`). Every route from here on
uses both.
**verify:** an unauthenticated request to `POST /api/repos` returns 401 with
`{ error: { code: 'unauthorized' } }`.

### T1.2 Storage bucket + signed upload

Create the private `designs` bucket (500 MB object limit). Build
`app/api/uploads/sign/route.ts`: input `{ sha256, filename, size }`; if the blob already
exists return `{ alreadyExists: true }`; otherwise `createSignedUploadUrl` at path
`blobs/<sha256>` and return `{ signedUrl, token, path }`.
**verify:** call it twice with the same sha — second call returns `alreadyExists: true`.

### T1.3 Client upload path

`components/upload-dropzone.tsx`: hash with `crypto.subtle.digest('SHA-256', buf)`, request a
signed URL, upload via `supabase.storage.from('designs').uploadToSignedUrl(path, token, file)`,
show progress. Skip the upload when `alreadyExists`.
**verify (phase-critical):** upload a **40 MB** file on the *deployed* Vercel app, not just
locally. This proves the file bypasses the serverless body limit. If this fails, the flow in
`ARCHITECTURE.md` §4 has been implemented wrong — do not work around it by raising a limit.

### T1.4 Staging

`app/api/repos/[id]/stage/route.ts`: POST upserts `blobs`, `blob_metrics` (nulls allowed at
this stage), and `staged_files`. DELETE stages a removal by writing a row with `sha256 = null`.
**verify:** upload a file, query `staged_files`, see one row.

### T1.5 Commit RPC

Write the `plpgsql` function `create_commit(p_repo_id, p_branch, p_message, p_author)` doing
all five steps from `ARCHITECTURE.md` §5 in one transaction. Add it to a new migration
`0002_create_commit.sql`. Then `lib/domain/commits.ts` calling it via `supabase.rpc()`, and
`app/api/repos/[id]/commits/route.ts` (POST commit, GET log).
**verify:** commit a staged file → one `commits` row, correct `commit_files`, branch head
advanced, `staged_files` empty. Then commit again with nothing staged → `nothing_staged` error
and **no** new commit row.

### T1.6 Ref resolution

`lib/domain/refs.ts` — `resolveRef(repoId, ref)` handling `HEAD`, branch name, tag name, short
sha, in that precedence order. Returns the commit row or null.
**verify:** unit test covering all four forms plus an unknown ref returning null.

### T1.7 Command infrastructure

`lib/commands/tokenize.ts` (quote-aware; `commit -m "two words"` → 3 tokens),
`registry.ts`, `run.ts`, and `lib/client-api.ts`. Implement `help`, `whoami`, `clear`,
`status`, `ls`, `log`, `add`, `rm`, `commit`.
**verify:** unit test on the tokenizer for `commit -m "a b" --amend`; then in the UI run
`add`/`commit`/`log` end to end and see the commit appear.

### T1.8 File browser + command bar

`[owner]/[repo]/layout.tsx` (loads repo, branches, HEAD; renders `CommandBar`),
`page.tsx` (file list at current ref), `components/terminal-output.tsx` with scrollback in
`sessionStorage` keyed by repo id.
**verify (phase gate):** upload two files, commit, reload the page, both files listed at HEAD;
`log` shows the commit. Upload the same file a second time → still one row in `blobs`.

---

## Phase 2 — Mesh parsing and metrics

**Exit condition:** cube volume correct within 0.1%; a `.sldprt` versions without erroring.

### T2.1 Fixtures — ALREADY DONE

`fixtures/` is generated and verified. **Read `fixtures/README.md` before T2.2** — its metrics
table is the specification your TypeScript must reproduce, and it explains the two traps
deliberately planted in the files (the binary STL with a `solid` header, and the open shell
whose volume must come back null).

Do not regenerate or modify these files. `large.stl` is gitignored; recreate it with
`python3 fixtures/generate.py` if it is missing.
**verify:** `python3 fixtures/verify.py` prints six `OK` lines and exits 0.

### T2.2 Parsers

`lib/mesh/parse.ts` — `detectFormat()` and `parseSTL()` implementing the binary-vs-ASCII check
from `ARCHITECTURE.md` §7 (the byte-length arithmetic, **not** the `solid` prefix). Add
`parseOBJ` and `parse3MF` via three.js loaders. Malformed input throws a typed `ParseError`.
**verify:** unit tests parse both cube STLs to 12 triangles; a truncated file throws
`ParseError` rather than returning garbage.

### T2.3 Metrics

`lib/mesh/metrics.ts` — `computeMetrics()` per `ARCHITECTURE.md` §7. Signed-tetrahedron volume,
triangle-area sum, bbox, area-weighted centroid, watertightness via the quantized edge map.
**verify (correctness anchor):** `cube-20mm.stl` → volume 8000 mm³ ±0.1%, surface area
2400 mm² ±0.1%, `isWatertight: true`. `open-shell.stl` → `volumeMm3: null`,
`isWatertight: false`. **A non-null volume on the open shell is a bug, not a rounding issue.**

### T2.4 Worker

`lib/mesh/worker.ts` + `useMeshWorker.ts`. Instantiate with
`new Worker(new URL('./worker.ts', import.meta.url))`. Transfer the positions buffer rather
than copying. Wire the dropzone to compute metrics before staging.
**verify:** upload `large.stl` (>50 MB) — the UI stays responsive (scrolling and typing work
during the parse).

### T2.5 Viewer

`components/viewer.tsx`, dynamically imported with `ssr: false`. Frame the camera from the
bbox. Dispose geometry and materials on unmount. `blob/[...path]/page.tsx` renders it.
**verify:** open the bracket, orbit it. Navigate between ten commits and confirm memory does
not climb without bound (Chrome devtools memory panel).

### T2.6 Graceful degradation

Unparseable formats stage with `{ kind: 'unparseable' }`, store a `blob_metrics` row with null
metrics, and the viewer shows "Preview unavailable for .step files — the file is stored and
versioned."
**verify (phase gate):** upload `part.sldprt`, commit it, check out the commit, share it. Every
step works; only the preview is absent, with an honest message. No console errors.

---

## Phase 3 — Diff

**Exit condition:** the re-tessellation test classifies as `reexported`, not `modified`.
This phase is the point of the product; do not rush it.

### T3.1 Tolerance + classification

`lib/mesh/tolerance.ts` (the constant object from `ARCHITECTURE.md` §7) and
`classifyChange()` in `lib/domain/diff.ts` implementing the six-way table in `PLAN.md` §5.
**verify:** unit tests for all six `ChangeKind` values, using `cube-20mm.stl` vs
`cube-20mm-refined.stl` for the `reexported` case.

### T3.2 Diff endpoint

`diffCommits(repoId, refA, refB)` producing `DiffResult`, exposed at
`GET /api/repos/[id]/diff?a=&b=`. Formatted `MetricDelta` values — `cm³` for volume, `cm²` for
area, mm for bbox.
**verify:** diff two commits of the bracket; every changed path appears with a populated delta list.

### T3.3 `diff` command + compare page

The `diff` command returning `{ type: 'diff' }`, and `compare/page.tsx` rendering
`components/dual-viewer.tsx` (one `OrbitControls`, both cameras synced per
`ARCHITECTURE.md` §8) above `metric-table.tsx`.

Include, verbatim, the disclosure from `PLAN.md` §8:

> Vector Vault reports that geometry changed and by how much. It does not yet show where.

Add the wireframe toggle and the 50%-opacity overlay mode.
**verify:** compare bracket v1 and v2 — dragging either canvas moves both; the table shows the
volume delta.

### T3.4 The C6 test

**verify (phase gate):** export the same unchanged part twice at different chord tolerances.
Commit both. `diff` must report `re-exported, geometry equivalent` — **not** `modified`. If it
reports `modified`, do not loosen `TOLERANCE` until you have confirmed the metrics genuinely
match; the tolerance is a guess and may need tuning, but a real geometry difference must not
be hidden by widening it. Record the tuned values in a commit message.

---

## Phase 4 — Branches, tags, sharing

**Exit condition:** a share link opens logged-out and shows exactly the pinned ref.

### T4.1 Branches
`GET`/`POST /api/repos/[id]/branches`, plus `branch` and `checkout` commands. `checkout <sha>`
enters a detached read-only view with a visible banner.
**verify:** create a branch, commit on it, `checkout main`, confirm the file set differs.

### T4.2 Tags and revert
`tag` and `revert` commands. Revert creates a **new** commit restoring the ref's file set;
it never deletes or rewrites.
**verify:** revert to the first commit → a new commit appears at the top of `log` and the file
set matches commit 1.

### T4.3 `merge` — the refusal
Fast-forward when the target branch is strictly ahead with no divergence. On divergence, refuse
with the exact message from `PLAN.md` §6, naming the diverged files.
**verify:** diverge two branches on the same file, run `merge` → the refusal, **no commit
created**. Then a fast-forward case → succeeds.

### T4.4 Share links
`POST /api/repos/[id]/shares` (32-byte base64url token, optional expiry),
`app/api/shared/[token]/route.ts` — the only importer of `admin.ts` — and `share/[token]/page.tsx`.
**verify (phase gate):** open a share URL in a logged-out incognito window: the pinned ref
renders with working downloads. Confirm the response body contains no other branches, no member
list, no repo settings. An expired token 404s. Re-run `grep -rn "admin" app/api/` — one hit.

---

## Phase 5 — Polish

- **T5.1** Landing page. State plainly what it does *and* the five limitations from `PLAN.md` §12.
- **T5.2** Empty states: no repos, no commits, no files, unparseable preview.
- **T5.3** Error handling: every `client-api.ts` call handles the `error` envelope; toasts, no
  silent failures, no unhandled promise rejections.
- **T5.4** Mobile: command bar and file list usable at 375 px. Dual viewer may stack vertically.
- **T5.5** `README.md`: setup, env vars, migrations, deploy, and the §12 limitations verbatim.
- **T5.6** `npm run test` green; `npm run build` clean with no type errors.

---

## Final gate

Before declaring the build done, run all seven end to end on the **deployed** app:

1. Sign up fresh → create repo → upload `bracket-v1.stl` → `commit -m "initial"`
2. Upload `bracket-v2.stl` → commit → `diff` shows a populated metric delta
3. Re-export test: unchanged part at a new tessellation → classified `reexported`
4. `.sldprt` uploads, commits, and shares with an honest "preview unavailable"
5. `branch feature-a` → commit → `merge main` on a diverged file → refuses cleanly
6. `share` → open the link in incognito → correct ref, downloads work, nothing else leaks
7. 40 MB file uploads successfully in production

Then follow `PLAN.md` §13: log the build in `kb/wiki/log.md` and open a decision page in
`kb/wiki/decisions/` on whether metric-only diffs proved legible without the SDF layer —
following `kb/AGENTS.md`, which is the authority on how wiki pages are written.

Report honestly: which of the seven passed, which failed, and what was left out. A build
reported as complete when step 3 or 5 was skipped is the specific failure this plan exists to
prevent.
