---
type: entity
title: Ondsel
created: 2026-08-15
updated: 2026-08-15
tags: [open-source-cad, freecad, defunct, market-evidence]
status: active
confidence: high
sources: ["[[ondsel-shutdown-announcement]]", "[[hackaday-end-of-ondsel]]"]
category: org
---

# Ondsel

> A venture-backed company (2022-2024) that built a polished FreeCAD distribution and a
> cloud collaboration layer for it, then shut down after failing to find commercial
> adoption. The single most relevant precedent for Vector Vault.

## What it is

Two products: **Ondsel ES**, a FreeCAD distribution with an improved UI, faster releases,
and better Sketcher/TechDraw workbenches; and **Lens**, a cloud platform for sharing models
with privacy controls, PIN-protected links, and online modification of published parametric
designs [[ondsel-shutdown-announcement]].

Defunct as of late 2024.

## Key facts

| Fact | Source | As of |
|---|---|---|
| Operated ~2 years before shutdown | [[ondsel-shutdown-announcement]] | 2024-11 |
| Surveyed/interviewed ~100 engineers | [[ondsel-shutdown-announcement]] | 2024-11 |
| "Failed to find commercial adoption to justify a venture-capitalized startup" | [[ondsel-shutdown-announcement]] | 2024-11 |
| ~150 PRs merged upstream into FreeCAD, largely in 1.0 | [[hackaday-end-of-ondsel]] | 2024-11-12 |

## How it works / what it does

Lens is worth studying closely: it is the closest existing implementation of the Vector
Vault idea in the open-source mechanical world, and the fact that it included
PIN-protected private sharing rather than public repositories is a signal about what users
actually asked for [[ondsel-shutdown-announcement]].

## History

Founded ~2022 on FreeCAD. Shipped ES and Lens. Announced shutdown November 2024. Residual
value went upstream into FreeCAD 1.0 [[hackaday-end-of-ondsel]].

## Contradictions

The company's own post attributes failure to absent commercial demand
[[ondsel-shutdown-announcement]]. An Ondsel team member, commenting publicly, attributes it
instead to targeting the wrong segment — arguing the real market is "smaller teams that are
new ideas and aren't married to specific software," not enterprises
[[hackaday-end-of-ondsel]]. Both dated 2024-11. Not resolved; tracked in
[[who-pays-for-cad-collaboration]].

## Open questions

- Did Lens fail on demand or on the requirement to switch CAD tools first? The sources do
  not separate these, and it is the decisive question for anything built next.
- Is the Lens source available anywhere post-shutdown?

## Related

- [[freecad]] — what Ondsel built on
- [[who-pays-for-cad-collaboration]] — the question this entity is evidence for
- [[allspice]] — the contrasting commercial outcome
