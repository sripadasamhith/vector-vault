---
type: concept
title: ECAD/MCAD Versioning Asymmetry
created: 2026-08-15
updated: 2026-08-15
tags: [ecad, mcad, market-structure, diffing]
status: active
confidence: medium
sources: ["[[allspice-git-for-hardware-pros-cons]]", "[[techcrunch-allspice-series-a]]", "[[ondsel-shutdown-announcement]]"]
---

# ECAD/MCAD Versioning Asymmetry

> Electronics design got working Git-style collaboration tooling and a funded market before
> mechanical design did — because ECAD artifacts are more structured and more projectable,
> not because the demand is different.

## The idea

The commercial record is lopsided. In electronics, [[allspice]] raised $6M on top of a $3.2M
seed and reported 10x year-over-year growth [[techcrunch-allspice-series-a]], with
[[cadlab-io]] in the same niche. In mechanical, [[ondsel]] shut down after failing to find
adoption [[ondsel-shutdown-announcement]].

The interesting part is *why*, and the answer is mostly technical.

## Why it matters here

Vector Vault is aimed at the mechanical side, which is the side that has not worked
commercially. Understanding the asymmetry tells you what has to be true for the mechanical
version to work — and which of AllSpice's advantages do not come for free.

## Mechanism / how it works

Three structural differences:

1. **Projectability.** A PCB has a canonical 2D representation. Rendering it
   deterministically and diffing the renderings is well-defined
   [[allspice-git-for-hardware-pros-cons]]. A 3D solid has no canonical viewpoint — the
   central obstacle noted in [[geometry-diffing]].
2. **Discrete structure.** Schematics decompose into components, nets, and connections —
   nameable, countable objects with stable identity. Solids decompose into faces and edges
   whose identity is not stable across edits, per [[parametric-feature-history]].
3. **BOM as a text spine.** Every PCB has a bill of materials that is genuinely tabular and
   genuinely diffable, giving reviewers a meaningful text-shaped artifact even when the
   layout is opaque. AllSpice ships BOM diffs alongside visual diffs
   [[allspice-git-for-hardware-pros-cons]]. Mechanical assemblies have BOMs too — the
   nearest available equivalent, and worth exploiting.

A fourth, non-technical difference: electrical engineers sit closer to software culture and
already work with tools that emit text (SPICE, HDL, firmware), so Git idioms need less
selling.

## Evidence

| Claim | Support | Against | Confidence |
|---|---|---|---|
| ECAD collaboration tooling found a market | [[techcrunch-allspice-series-a]] | company-reported figures only | medium |
| MCAD equivalent did not | [[ondsel-shutdown-announcement]] | segment/tool-switching confound [[hackaday-end-of-ondsel]] | medium |
| ECAD formats are more structured and projectable | [[allspice-git-for-hardware-pros-cons]] | — | high |
| The gap is technical rather than demand-side | inference from the above | — | low-medium |

## Instances

- [[allspice]], [[cadlab-io]] — the ECAD side
- [[ondsel]] — the MCAD side
- [[onshape]] — the MCAD exception, and only in-platform

## Limits and failure modes

- **The comparison is confounded.** Ondsel also required users to adopt a different CAD
  system; AllSpice worked with the ECAD tools people already had. That difference alone
  could explain both outcomes without any format argument. This is the most important
  caveat on this page — see [[who-pays-for-cad-collaboration]].
- **ECAD binary layouts are not actually mergeable either**
  [[allspice-git-for-hardware-pros-cons]]. The asymmetry is about *review*, not merge.

## Contradictions

None between sources; the confound above is a competing explanation of the same evidence,
not a source conflict.

## Related

- [[geometry-diffing]] — the technical crux
- [[who-pays-for-cad-collaboration]] — the commercial reading
- [[allspice]] — the pattern to learn from
