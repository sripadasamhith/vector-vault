# Vector Vault — Architecture

Companion to `PLAN.md` (what to build and why) and `BUILD.md` (the ordered procedure).
This file defines **shape**: module boundaries, data flow, and the type contracts every
module agrees on. Read it before writing any code; re-read the relevant section before
starting each task.

The single most important rule in this document is the layering rule in §2. Almost every way
this codebase can rot is a violation of it.

---

## 1. File tree

Create exactly this. Do not add directories not listed here without a reason recorded in a
commit message.

```
app/
  layout.tsx                          root layout, theme, fonts
  page.tsx                            landing
  login/page.tsx
  auth/callback/route.ts              Supabase OAuth/magic-link return
  dashboard/page.tsx                  repo list + create
  [owner]/[repo]/
    layout.tsx                        loads repo + branches, renders CommandBar
    page.tsx                          file browser at current ref
    commits/page.tsx                  history
    commit/[sha]/page.tsx             one commit + change table
    compare/page.tsx                  dual viewer + metric deltas
    blob/[...path]/page.tsx           single-file viewer
  share/[token]/page.tsx              read-only, unauthenticated
  api/
    uploads/sign/route.ts
    repos/route.ts                            POST create, GET list
    repos/[id]/stage/route.ts                 POST stage, DELETE unstage
    repos/[id]/commits/route.ts               POST commit, GET log
    repos/[id]/commits/[ref]/route.ts         GET one commit
    repos/[id]/diff/route.ts                  GET ?a=&b=
    repos/[id]/branches/route.ts              GET list, POST create
    repos/[id]/tags/route.ts                  GET list, POST create
    repos/[id]/revert/route.ts                POST
    repos/[id]/shares/route.ts                POST
    shared/[token]/route.ts                   GET, public
    blobs/[sha256]/url/route.ts               GET signed download URL

lib/
  supabase/
    client.ts                         browser client (anon key)
    server.ts                         RSC/route client (anon key + user session)
    admin.ts                          service-role client — SERVER ONLY, share reads only
  api/
    envelope.ts                       ok() / fail() + ApiError codes
    guard.ts                          requireUser(), requireRepoRole()
  domain/
    refs.ts                           resolveRef()
    commits.ts                        createCommit(), listCommits(), getCommitFiles()
    diff.ts                           diffCommits(), classifyChange()
    shares.ts                         mintShare(), resolveShare()
  mesh/
    types.ts                          MeshMetrics, ParsedMesh, SupportedFormat
    parse.ts                          parseSTL / parseOBJ / parse3MF / detectFormat
    metrics.ts                        computeMetrics()
    tolerance.ts                      TOLERANCE constants + withinTolerance()
    worker.ts                         Web Worker entry
    useMeshWorker.ts                  React hook wrapping the worker
  commands/
    tokenize.ts                       quote-aware tokenizer
    types.ts                          Command, CommandContext, CommandResult
    registry.ts                       name -> Command map
    impl/*.ts                         one file per command
  client-api.ts                       typed fetch wrappers — the ONLY place fetch() appears

components/
  command-bar.tsx
  terminal-output.tsx
  upload-dropzone.tsx
  file-list.tsx
  viewer.tsx                          single three.js canvas
  dual-viewer.tsx                     two canvases, one shared camera state
  metric-table.tsx
  change-badge.tsx

supabase/migrations/0001_init.sql
fixtures/                             test CAD files (see PLAN.md §10)
```

---

## 2. The layering rule

```
components/ ──▶ lib/commands/ ──▶ lib/client-api.ts ──▶ app/api/** ──▶ lib/domain/ ──▶ Supabase
                                        (HTTP boundary)
```

Each arrow is one-way. Concretely:

- **`lib/commands/**` must never import Supabase or call `fetch` directly.** Commands receive a
  context object and call `client-api.ts`. This is what makes the command set portable to a
  real CLI later, which is the whole reason for the boundary.
- **`lib/domain/**` runs server-side only** and is the only place that reads or writes tables.
  API routes contain no query logic — they parse input, call a domain function, and shape the
  response.
- **`lib/mesh/**` is pure.** No network, no database, no React. Input `ArrayBuffer`, output
  plain objects. This makes it trivially testable, which matters because it holds the
  correctness-critical math.
- **`lib/supabase/admin.ts` may be imported by exactly one file**: `app/api/shared/[token]/route.ts`.
  If a second import appears, the share-link design has been misunderstood — stop and re-read
  §6 rather than widening access.

If a task seems to require breaking one of these, the task has been misread. Stop and ask.

---

## 3. Type contracts

These are the interfaces modules agree on. Define them once, in the file named, and import
everywhere else. Do not redeclare shapes inline.

### `lib/mesh/types.ts`

```ts
export type SupportedFormat = 'stl' | 'obj' | '3mf';
export type KnownFormat = SupportedFormat | 'step' | 'iges' | 'native' | 'unknown';

export interface MeshMetrics {
  format: KnownFormat;
  triangleCount: number;
  /** null when the mesh is not watertight — volume is meaningless then. */
  volumeMm3: number | null;
  surfaceAreaMm2: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  /** Area-weighted. */
  centroid: [number, number, number];
  isWatertight: boolean;
}

export interface ParsedMesh {
  positions: Float32Array;   // flat xyz triples, 9 floats per triangle
  metrics: MeshMetrics;
}

/** Formats we cannot parse still get a row, with everything null. C4 in PLAN.md. */
export type MetricsResult =
  | { kind: 'parsed'; metrics: MeshMetrics }
  | { kind: 'unparseable'; format: KnownFormat };
```

### `lib/domain/diff.ts`

```ts
export type ChangeKind =
  | 'unchanged'
  | 'reexported'      // bytes differ, geometry equivalent within tolerance (C6)
  | 'modified'
  | 'added'
  | 'removed'
  | 'binary';         // no metrics available on one or both sides

export interface MetricDelta {
  label: string;         // 'volume'
  a: string | null;      // '41.20 cm³' — preformatted for display
  b: string | null;
  deltaPct: number | null;
  significant: boolean;  // outside TOLERANCE
}

export interface FileChange {
  path: string;
  kind: ChangeKind;
  shaA: string | null;
  shaB: string | null;
  deltas: MetricDelta[];  // empty for added/removed/binary
}

export interface DiffResult {
  a: { ref: string; shortSha: string };
  b: { ref: string; shortSha: string };
  changes: FileChange[];
}
```

### `lib/commands/types.ts`

```ts
export interface CommandContext {
  repoId: string;
  owner: string;
  slug: string;
  branch: string;
  userId: string;
  /** Commands navigate by calling this, never by touching the router directly. */
  navigate: (href: string) => void;
  /** Mutates client cache after a write. */
  refresh: () => void;
}

export type CommandOutput =
  | { type: 'text'; lines: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'diff'; result: DiffResult }
  | { type: 'error'; message: string; hint?: string };

export interface CommandResult {
  output: CommandOutput;
  /** Set when the command changed server state, so the page can revalidate. */
  mutated?: boolean;
}

export interface Command {
  name: string;
  summary: string;        // one line, shown by `help`
  usage: string;          // 'commit -m "<message>"'
  run(args: string[], ctx: CommandContext): Promise<CommandResult>;
}
```

### `lib/api/envelope.ts`

Every route returns one of these. No bare objects, no thrown strings.

```ts
export type ApiErrorCode =
  | 'unauthorized' | 'forbidden' | 'not_found'
  | 'invalid_input' | 'conflict' | 'nothing_staged' | 'cannot_merge';

export type ApiResponse<T> =
  | { data: T }
  | { error: { code: ApiErrorCode; message: string; hint?: string } };
```

---

## 4. Data flow: upload → commit

The one flow worth drawing, because it is the flow most likely to be built wrong. Note that
the file never passes through a Next.js route (see `PLAN.md` §3 — Vercel's ~4.5 MB body cap).

```
Browser                          Next.js API              Supabase
   │
   │ 1. user drops bracket.stl
   │
   │ 2. sha256 = crypto.subtle.digest(ArrayBuffer)
   │    (requires https or localhost)
   │
   ├─ POST /api/uploads/sign ───────▶│
   │    { sha256, filename, size }   │
   │                                 ├─ createSignedUploadUrl ──▶│
   │◀── { signedUrl, token, path } ──┤◀──────────────────────────┤
   │                                 │
   ├─ 3. uploadToSignedUrl(file) ───────────────────────────────▶│  Storage
   │      (direct, bypasses Vercel)                              │
   │
   │ 4. Web Worker: parse + computeMetrics
   │    → MetricsResult
   │
   ├─ POST /api/repos/:id/stage ────▶│
   │    { path, sha256, size,        ├─ upsert blobs
   │      metrics }                  ├─ upsert blob_metrics
   │                                 ├─ upsert staged_files
   │◀── { data: { staged } } ────────┤
   │
   │ 5. vault> commit -m "..."
   ├─ POST /api/repos/:id/commits ──▶│
   │    { message, branch }          ├─ copy HEAD commit_files
   │                                 ├─ apply staged (null sha = delete)
   │                                 ├─ insert commit + commit_files
   │                                 ├─ update branches.head_id
   │◀── { data: { shortSha } } ──────┤─ clear staged_files
```

**Step 2 before step 3 is deliberate.** Hashing first means an already-known blob can skip the
upload entirely — `/api/uploads/sign` returns `{ alreadyExists: true }` and the client jumps
straight to staging. Free deduplication, and it makes re-committing an unchanged file instant.

---

## 5. Commit model

Snapshot-based, not tree-based. Every commit stores a complete file list.

```
commits:  root ◀── c2 ◀── c3 ◀── c4        (parent_id chain)
                            ▲       ▲
                     branches.head  │
                            │       └── branches['main'].head_id
                            └── branches['feature-a'].head_id

commit_files(c4) = [ ('bracket.stl', sha_x), ('housing/lid.step', sha_y) ]
```

Creating a commit:

1. Read `commit_files` for the branch's current head (empty set if root commit)
2. Apply staged rows: `sha256` present → upsert path; `sha256` null → drop path
3. If the resulting file set is byte-identical to the parent's, **refuse** with
   `nothing_staged` — do not create empty commits
4. `short_sha` = first 7 hex of `sha256(parentId ?? '' + message + sortedPathShaPairs + isoTimestamp)`,
   retry with a counter appended on the unique-constraint collision
5. Insert commit, insert all `commit_files`, update `branches.head_id`, delete staged rows —
   **in one Postgres RPC function**, so a mid-sequence failure cannot leave a half-written
   commit. Write it as a `plpgsql` function in the migration; call it via `supabase.rpc()`.

Step 5 is the only genuinely transactional operation in the app. Do not implement it as a
series of client-side calls.

---

## 6. Access control

Two independent paths. Keep them independent.

**Authenticated path** — RLS does the work. Every table has policies; API routes use the
user-scoped client from `lib/supabase/server.ts`, so a query for a repo the user cannot see
returns zero rows rather than an error. Routes still call `requireRepoRole()` for a clean
403 with a useful message.

**Share path** — one route, `app/api/shared/[token]/route.ts`, is the sole consumer of the
service-role client. It:

1. Looks up the token, checks `expires_at`
2. Resolves the pinned ref to a commit
3. Returns **only** that commit's file list, metrics, and short-lived signed download URLs
4. Never returns other refs, branch lists, member lists, or repo settings

Do not implement sharing by adding a permissive RLS policy. The token is not a user and
should not be modelled as one.

Roles: `owner` (everything incl. delete and share), `writer` (commit, branch, tag),
`reader` (read only).

---

## 7. Mesh module invariants

Correctness-critical, so state the invariants explicitly:

- **Format detection never trusts the extension alone.** For STL, decide binary vs ASCII by
  checking `84 + 50 * triangleCount === byteLength`, where `triangleCount` is the uint32 at
  offset 80. The `solid` ASCII prefix is present in many binary files and is not a reliable signal.
- **Volume is null unless watertight.** The signed-tetrahedron sum returns a number for open
  meshes too, but it is meaningless. Return null and set `isWatertight: false`.
- **Watertightness** = every undirected edge appears exactly twice, with opposite winding.
  Build the edge map with quantized vertex keys (round to 1e-6) so float noise doesn't split
  shared vertices.
- **Units are assumed, never inferred.** STL and OBJ carry none. Display "mm (assumed)".
- **All parsing happens in the Worker.** The main thread never parses a mesh — a 50 MB STL
  will freeze the UI for seconds.

Tolerance lives in `lib/mesh/tolerance.ts` as one exported object and is imported everywhere.
It will be tuned against real files; it must not be scattered as literals.

```ts
export const TOLERANCE = {
  relativeVolume: 0.001,      // 0.1%
  relativeSurfaceArea: 0.001,
  absoluteBboxMm: 0.01,
} as const;
```

---

## 8. Rendering

- One `<Viewer>` component wrapping a three.js scene; `<DualViewer>` composes two of them and
  drives both cameras from a single `OrbitControls` instance attached to the left canvas —
  copy `camera.position` and `camera.quaternion` to the right camera in the animation loop.
- Geometry comes from the Worker as a `Float32Array` of positions, **transferred** (not copied)
  into the main thread, then wrapped in a `BufferGeometry`. Call `computeVertexNormals()`.
- Frame the camera from the parsed bbox, not a fixed distance — CAD parts range from 2 mm to
  2 m and a fixed camera will show an empty scene half the time.
- **Dispose geometries and materials on unmount.** Repeated navigation between commits leaks
  GPU memory otherwise, and it will not be obvious until the tab crashes.
- three.js must be dynamically imported (`next/dynamic` with `ssr: false`) — it touches
  `window` at module scope and will break the RSC build otherwise.

---

## 9. What each layer may assume

| Layer | Trusts | Must validate |
|---|---|---|
| `lib/mesh/**` | Nothing. Input is a hostile ArrayBuffer. | Byte lengths before every read; malformed files throw a typed `ParseError`. |
| `app/api/**` | Authenticated user id from Supabase. | All body/query input via Zod. Client-supplied metrics: finite, non-negative, sane triangle count. |
| `lib/domain/**` | Its callers have validated input and checked roles. | Referential facts only — does this ref exist, is this branch real. |
| `components/**` | API responses match their declared types. | Nothing — but handle the `error` envelope on every call. |

Client-computed metrics are untrusted and recorded as `metrics_source: 'client'`. Range-check
them; do not attempt server-side recomputation in v1 (noted as a v2 hardening item).
