---
type: concept
title: Neutral Exchange Formats
created: 2026-08-15
updated: 2026-08-15
tags: [step, stl, 3mf, file-formats, interoperability]
status: active
confidence: medium
sources: ["[[capvidia-step-application-protocols]]", "[[github-3d-file-viewer-docs]]"]
---

# Neutral Exchange Formats

> Vendor-independent file formats (STEP, IGES, STL, 3MF) that let designs move between CAD
> systems by standardizing a subset of the data — geometry, mostly — and dropping the rest.

## The idea

Because native CAD formats are proprietary and "cannot directly be translated nor converted
to another proprietary CAD system" [[capvidia-step-application-protocols]], interchange runs
through neutral formats. They form a ladder of fidelity:

| Format | Carries | Drops |
|---|---|---|
| STL | Triangle mesh, nothing else | Solids, units convention, assemblies, colors, intent |
| 3MF | Mesh plus color, materials, print metadata | Solids, feature history |
| IGES | Surfaces, curves (legacy) | Solids robustness, PMI |
| STEP AP203 | BREP solids, topology, configuration control | Colors, PMI, kinematics |
| STEP AP214 | AP203 plus colors/layers, GD&T presentation, construction history, kinematics | Semantic PMI |
| STEP AP242 | AP203 + AP214 plus semantic PMI, parametric and geometric constraints, kinematics assembly, harness, piping, DRM, archiving | Native feature history and design intent |

AP242 merges and supersedes the older two; ISO/TC 184/SC 4 withdrew from further work on
them — "AP203 and AP214 are withdrawn...They were deprecated with the publication of AP242
in 2014" — though both remain widely used in practice
[[capvidia-step-application-protocols]].

## Why it matters here

Whatever Vector Vault stores, this table sets the ceiling on what it can reason about. Store
STL and you can only compare shapes. Store STEP AP242 and you can compare solids, assembly
structure, and tolerances — a far richer diff. Nothing available lets you compare *how the
model was built*: see [[parametric-feature-history]].

Note also that the free existing option, GitHub, renders STL only, under 10 MB
[[github-3d-file-viewer-docs]] — so the fidelity ladder is also a competitive gap.

## Mechanism / how it works

STEP files are ASCII, specified in the EXPRESS modeling language
[[capvidia-step-application-protocols]]. That has a practical consequence worth testing:
STEP is *text*, so it is nominally line-diffable — but entity IDs are renumbered on export
and geometry is emitted in unstable order, so naive text diffs are noise. Whether a
normalizing pre-pass makes STEP meaningfully diffable is an open, testable question and one
of the cheapest experiments available. (**Unverified** — hypothesis, not a finding.)

## Evidence

| Claim | Support | Against | Confidence |
|---|---|---|---|
| AP242 supersedes AP203/AP214, deprecated 2014 | [[capvidia-step-application-protocols]] | — | high |
| STEP drops native feature history | [[capvidia-step-application-protocols]] | — | high |
| AP242 carries semantic PMI | [[capvidia-step-application-protocols]] | — | medium — standard capability, not exporter reality |
| STEP is text and therefore normalizable for diffing | inference from EXPRESS/ASCII | — | low — untested |

## Instances

- [[github-3d-file-viewer]] — STL only, the bottom rung
- [[onshape]] — export fidelity unverified
- [[cad-files-as-compiled-artifacts]] — the thesis this ladder illustrates

## Limits and failure modes

- **Capability is not support.** AP242 defining semantic PMI says nothing about whether a
  given exporter writes it or a given importer reads it. Treat as a spectrum.
- **Capvidia sells translation and validation software**, so its framing of interoperability
  difficulty is interested. The factual claims check out against the ISO record; the
  severity framing should be discounted.
- **STL persists despite being worst** because it is universally supported and trivially
  parsed. Format quality does not determine adoption.

## Contradictions

None recorded.

## Related

- [[cad-files-as-compiled-artifacts]] — why the ladder is lossy in the first place
- [[parametric-feature-history]] — the rung above the top of this ladder, which does not exist
- [[geometry-diffing]] — what you can compute at each rung
