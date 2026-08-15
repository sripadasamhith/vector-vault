---
type: entity
title: AllSpice
created: 2026-08-15
updated: 2026-08-15
tags: [ecad, git, visual-diff, competitor, prior-art]
status: active
confidence: medium
sources: ["[[allspice-git-for-hardware-pros-cons]]", "[[techcrunch-allspice-series-a]]"]
category: service
---

# AllSpice

> A Git-based collaboration platform for hardware (primarily electronics) that adds visual
> diffs of schematics and PCB layouts on top of ordinary Git — the closest thing to a
> working "GitHub for hardware."

## What it is

A Gitea-derived hosting platform aimed at electrical engineers, adding component library
management, CI ("Actions"), supply-chain availability checks, and — the differentiating
feature — automatic visual diffs of native ECAD files [[allspice-git-for-hardware-pros-cons]].

## Key facts

| Fact | Source | As of |
|---|---|---|
| Founded by Valentina Ratner and Kyle Dumont | [[techcrunch-allspice-series-a]] | 2023-12-05 |
| Raised $6M following a $3.2M seed (2022) | [[techcrunch-allspice-series-a]] | 2023-12-05 |
| Investors: Root Ventures, Flybridge, Bowery Capital, Benchstrength | [[techcrunch-allspice-series-a]] | 2023-12-05 |
| Pivoted from SMB to enterprise | [[techcrunch-allspice-series-a]] | 2023-12-05 |
| Company-reported 10x YoY user and revenue growth | [[techcrunch-allspice-series-a]] | 2023-12-05 |
| Renders native ECAD formats to SVG with red/yellow/green change highlighting | [[allspice-git-for-hardware-pros-cons]] | 2026-08-15 |

## How it works / what it does

The architecture worth stealing: **do not diff the file, diff a rendering of the file.**
Parse the native format, render deterministically to SVG, then compare renderings and
highlight the delta. This sidesteps the impossibility of merging interwoven binary formats
while still giving reviewers something legible — including reviewers with no CAD license,
which [[allspice-git-for-hardware-pros-cons]] identifies as a major unlock.

It does not solve merge. It solves *review*. That distinction matters for scoping Vector
Vault.

## History

Seed 2022, $6M 2023, SMB-to-enterprise pivot. No verified information gathered for
2024-2026 — flagged as a gap.

## Contradictions

Its commercial trajectory contradicts the simple reading of the Ondsel shutdown that this
category cannot be sold. Recorded in [[who-pays-for-cad-collaboration]].

## Open questions

- Any independent (non-company-reported) evidence of scale since 2023?
- How much of the value is the visual diff versus simply being Gitea-with-hardware-defaults?

## Related

- [[ecad-mcad-versioning-asymmetry]] — why this works for PCBs first
- [[geometry-diffing]] — the render-then-diff pattern generalized
- [[cadlab-io]] — the closest competitor
- [[ondsel]] — the contrasting outcome
