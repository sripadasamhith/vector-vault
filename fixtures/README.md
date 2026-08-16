# Fixtures — ground truth

Test files for `BUILD.md` Phase 2 and 3. Generated analytically by `generate.py`, so the
expected metrics below are exact, not measured. **These numbers are the specification** —
when `lib/mesh/metrics.ts` disagrees with this table, the TypeScript is wrong.

Regenerate with:

```bash
python3 fixtures/generate.py
```

## Expected metrics

Units are millimetres. Volume is `null` for non-watertight meshes by definition
(`ARCHITECTURE.md` §7) — a number there is a bug, not a rounding artifact.

| file | encoding | triangles | volume mm³ | area mm² | bbox mm | watertight | bytes |
|---|---|---|---|---|---|---|---|
| `cube-20mm.stl` | **binary** | 12 | 8000 | 2400 | 20×20×20 | yes | 684 |
| `cube-20mm-ascii.stl` | ascii | 12 | 8000 | 2400 | 20×20×20 | yes | 3,018 |
| `cube-20mm-refined.stl` | binary | 192 | 8000 | 2400 | 20×20×20 | yes | 9,684 |
| `open-shell.stl` | binary | 10 | **null** | 2000 | 20×20×20 | **no** | 584 |
| `bracket-v1.stl` | binary | 12 | 38400 | 9280 | 80×40×12 | yes | 684 |
| `bracket-v2.stl` | binary | 12 | 32000 | 8800 | 80×40×10 | yes | 684 |
| `large.stl` | binary | 943,110 | 523589.75 | 31415.66 | 100×100×100 | yes | 47,155,584 |
| `part.step` | text | — | — | — | — | — | 415 |
| `part.sldprt` | binary | — | — | — | — | — | 2,056 |

Tolerance for the checks: 0.1% relative on volume and area.

## What each file is for

**`cube-20mm.stl` — the correctness anchor, and a trap.**
Exactly 20×20×20, so volume is exactly 8000 mm³ and area exactly 2400 mm².
It is a **binary** STL whose 80-byte header deliberately begins with the ASCII string
`solid`. A parser that sniffs the `solid` prefix will misread it as ASCII and fail. Only the
byte-length arithmetic (`84 + 50 × count === byteLength`) from `ARCHITECTURE.md` §7 detects
it correctly. T2.2 passes only if this file parses as binary.

**`cube-20mm-ascii.stl`** — same geometry, genuinely ASCII. Covers the other parser branch;
must produce identical metrics to the binary cube.

**`cube-20mm-refined.stl` — the C6 anchor.**
The same cube with each face subdivided 4×4: 192 triangles instead of 12, completely different
bytes, and **identical volume and surface area to 6+ decimal places**. This stands in for
re-exporting an unchanged part at a finer chord tolerance. In T3.4 the diff must classify
`cube-20mm.stl` → `cube-20mm-refined.stl` as `reexported`, never `modified`. This single pair
is the sharpest test in the build.

**`open-shell.stl`** — the cube with its top face removed. 10 triangles, not watertight.
The signed-tetrahedron sum still returns a number here (roughly 6666), which is meaningless.
`computeMetrics` must return `volumeMm3: null` and `isWatertight: false`. Returning ~6666 is
the specific failure this fixture exists to catch.

**`bracket-v1.stl` / `bracket-v2.stl`** — a real change: an 80×40 plate thinned from 12 mm to
10 mm. Volume 38400 → 32000 mm³ (−16.67%), area 9280 → 8800 mm² (−5.17%), bbox Z 12 → 10.
Used for the compare view in T3.3; every delta row should be populated and marked significant.

**`large.stl`** — a 943k-triangle sphere, **45.0 MiB**. Two jobs: prove the direct-to-storage
upload path in T1.3 (well past Vercel's ~4.5 MB body cap) and prove the Web Worker keeps the
UI responsive in T2.4. Not committed to git — regenerate it locally.

Sized at 45 MiB deliberately. The Supabase **free plan caps uploads at 50 MiB globally** —
verified live: `PUT /storage/v1/bucket/designs` with a 500 MB limit returns
`413 EntityTooLarge`, and the bucket stays at 50 MiB. A larger fixture would fail to upload
for platform reasons and look like an app bug.

**`part.step`** — a minimal but syntactically valid STEP AP203 file. Exercises C4: it must
store, version, share, and download, and must show "preview unavailable" rather than erroring.

**`part.sldprt`** — an opaque proprietary blob (an OLE2 header and padding; not a real
SolidWorks part). Only the degradation path cares what is inside it.

## Note on units

STL carries no units. These files are authored in millimetres and the table assumes mm, which
matches the app's stated assumption. The app must display "mm (assumed)" rather than claiming
to know — see `ARCHITECTURE.md` §7.
