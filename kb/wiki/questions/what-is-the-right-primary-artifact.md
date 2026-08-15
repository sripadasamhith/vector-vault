---
type: question
title: What Is the Right Primary Artifact for Vector Vault?
created: 2026-08-15
updated: 2026-08-15
tags: [product-design, file-formats, core-decision]
status: active
confidence: low
sources: ["[[cad-files-as-compiled-artifacts]]", "[[capvidia-step-application-protocols]]", "[[allspice-git-for-hardware-pros-cons]]"]
---

# What Is the Right Primary Artifact for Vector Vault?

> What should actually be under version control: STL meshes, STEP solids, native CAD files,
> parametric feature trees, or a derived representation the system computes and owns?

## Why it matters

This choice sets the ceiling on every feature that follows. It determines what can be
diffed, what can be merged, who can open the result, and how big the addressable set of
files is. It is the one decision that is expensive to reverse.

## Current answer

**No decision yet.** Confidence: low — this is framed here so it can be answered
deliberately rather than by accident of implementation.

The options, with what each buys and costs:

| Artifact | Universality | Diffability | Design intent | Notes |
|---|---|---|---|---|
| STL | Highest — everything exports it | Geometric only | None | The files people actually have. Also the most degraded; see [[cad-files-as-compiled-artifacts]] |
| 3MF | Growing, print-centric | Geometric plus metadata | None | Strictly better than STL for the same audience |
| STEP AP242 | High in professional settings | Solid-level: faces, edges, assembly, PMI | Partial — no feature tree [[capvidia-step-application-protocols]] | The best neutral option available |
| Native CAD (`.sldprt`, `.f3d`, `.FCStd`) | Low, fragmented | Vendor-dependent, mostly opaque | Full, but unreadable | Requires per-vendor parsing; [[freecad]] is the only open one |
| Feature tree | Effectively zero — no interchange format exists | Semantic, the prize | Full | Blocked on access and topological naming; see [[parametric-feature-history]] |
| Derived representation | N/A — computed on ingest | Whatever you design it to be | Only what the input carried | The AllSpice pattern: don't diff the file, diff a rendering [[allspice-git-for-hardware-pros-cons]] |

The tension is stark: universality and diffability point in opposite directions. STL is what
everyone has and the least you can do anything with. The feature tree is what you would need
and the least accessible.

**Leading hypothesis (not a decision):** accept files at whatever fidelity users have, and
make the *derived representation* the primary artifact — normalize on ingest, store the
original immutably, and compute comparisons over the derived form. This is what AllSpice
does in 2D [[allspice-git-for-hardware-pros-cons]], it degrades gracefully (STL gets a
geometric diff, STEP gets a solid-level diff), and it does not require anyone to change
their CAD tool — which [[who-pays-for-cad-collaboration]] currently identifies as the
decisive constraint.

## Evidence for

- Neutral formats form a clear fidelity ladder — [[neutral-exchange-formats]]
- Render-then-diff is proven in production for ECAD — [[allspice-git-for-hardware-pros-cons]]
- Requiring a tool switch appears to be fatal — [[who-pays-for-cad-collaboration]]

## Evidence against

- **No evidence yet** that the render-then-diff pattern transfers to 3D solids, where there
  is no canonical viewpoint. This is the single biggest technical unknown — see
  [[geometry-diffing]].

## What would settle this

1. **Build the smallest possible experiment:** take two revisions of one real part as STL,
   compute a signed-distance colour map, and look at whether the output is legible to
   someone who did not make the change. One afternoon; answers the core feasibility question.
2. Repeat with STEP to see how much better solid-level comparison actually reads.
3. Read `bdlucas1/diff3d` first — it already claims STL, OBJ, 3MF, and STEP, so it may
   answer step 1 without writing anything.
4. Sample real files: what formats and sizes do target users actually have? Design for those,
   not for the ideal.

## History of the answer

| Date | Answer | What changed it |
|---|---|---|
| 2026-08-15 | Open; derived-representation hypothesis leading | Framed from [[cad-files-as-compiled-artifacts]] and the AllSpice pattern |

## Related

- [[cad-files-as-compiled-artifacts]] — why this question is hard
- [[geometry-diffing]] — what you can compute per artifact choice
- [[neutral-exchange-formats]] — the fidelity ladder
- [[parametric-feature-history]] — the unreachable top of the ladder
