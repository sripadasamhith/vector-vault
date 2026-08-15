---
type: concept
title: CAD Files as Compiled Artifacts
created: 2026-08-15
updated: 2026-08-15
tags: [thesis, file-formats, stl, design-intent]
status: active
confidence: high
sources: ["[[conversation-cad-sharing-problem]]", "[[allspice-git-for-hardware-pros-cons]]", "[[capvidia-step-application-protocols]]"]
---

# CAD Files as Compiled Artifacts

> Shared design files are outputs of a modeling process, not the process itself — closer to
> a compiled binary than to source code, which is why version control tooling built for
> source does not transfer.

## The idea

Software version control works because the artifact under version *is* the human-authored
input. Diff, merge, blame, and review all rest on that. Design files invert this. What gets
shared is the evaluated result: a mesh, or a boundary representation, with the authoring
history discarded.

STL is the extreme case — an unordered list of triangles with no parametrics, no assembly
structure, no feature history, no reliable units declaration, and no design intent. STEP is
better but still lossy: it "represents standardized data subsets rather than complete native
feature histories or parametric design intent" [[capvidia-step-application-protocols]]. The
authoring history lives only in the proprietary native format, which by construction
"cannot directly be translated nor converted to another proprietary CAD system"
[[capvidia-step-application-protocols]].

AllSpice reaches the same conclusion independently from the electronics side, and states it
sharply: binary design formats defeat merging because "all components, traces, nets,
attributes and other file features are interwoven in a file, with no way to discern changes
created by separate users," adding "This isn't a downside of Git, this is a downside of the
ECAD file formats" [[allspice-git-for-hardware-pros-cons]].

The analogy that makes it land: **sharing an STL is like shipping a stripped binary and
calling it open source** [[conversation-cad-sharing-problem]].

## Why it matters here

This is Vector Vault's central design constraint. It says:

1. A product that versions STL files is versioning build outputs. It can offer storage,
   history, and preview, but it structurally cannot offer diff, merge, or reuse.
2. The interesting question is not "how do we store this better" but "what is the right
   thing to put under version control." See [[what-is-the-right-primary-artifact]].
3. Cloud lock-in is downstream of this, not upstream of it — see
   [[is-cloud-lock-in-the-root-cause]].

## Mechanism / how it works

The modeling pipeline is roughly:

```
sketch + constraints + feature tree   ->   BREP solid   ->   tessellated mesh
   (design intent, native format)          (STEP-able)       (STL / 3MF)
```

Each arrow is lossy and one-way. Tessellation in particular is irreversible: you cannot
recover the cylinder from the triangles that approximate it. So the further right you share,
the less anyone downstream can do — and the rightmost point is the only one everyone can
open. That trade is the whole problem in one line.

## Evidence

| Claim | Support | Against | Confidence |
|---|---|---|---|
| Neutral formats drop feature history and design intent | [[capvidia-step-application-protocols]] | — | high |
| Binary interwoven formats make merge intractable | [[allspice-git-for-hardware-pros-cons]] | — | high |
| Native formats are not cross-translatable | [[capvidia-step-application-protocols]] | — | high |
| STL carries no design intent | format mechanics; [[conversation-cad-sharing-problem]] | — | high |
| Therefore local-first alone would not fix sharing | inference | — | medium |

## Instances

- [[github-3d-file-viewer]] — renders the artifact, cannot compare it
- [[git-lfs]] — stores the artifact cheaply, understands nothing about it
- [[neutral-exchange-formats]] — the standardized lossy handoff
- [[allspice]] — works around the problem by diffing renderings instead of files

## Limits and failure modes

- **The analogy is not exact.** Unlike a stripped binary, an STL is directly *useful* to the
  recipient: it prints, it renders, it can be measured. Many real handoffs need nothing more.
  Overstating this leads to building for a purity nobody asked for.
- **It does not follow that everyone wants source.** Suppliers are often given meshes
  deliberately, to protect IP. "Send the artifact, not the source" is sometimes the feature.
- **[[onshape]] is a partial counterexample:** inside one vendor's cloud, the source *is*
  under version control, and branch/merge works. The thesis is about files crossing
  boundaries, not about what a single vendor can do internally.

## Contradictions

None between sources. The Onshape material is in tension with the framing rather than the
substance, and is handled in [[cloud-lock-in-in-cad]].

## Related

- [[what-is-the-right-primary-artifact]] — the direct product consequence
- [[parametric-feature-history]] — the thing that gets lost
- [[neutral-exchange-formats]] — the lossy interchange layer
- [[geometry-diffing]] — what becomes hard as a result
- [[is-cloud-lock-in-the-root-cause]] — the framing this thesis corrects
