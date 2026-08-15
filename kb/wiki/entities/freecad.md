---
type: entity
title: FreeCAD
created: 2026-08-15
updated: 2026-08-15
tags: [open-source-cad, kernel, parametric]
status: stub
confidence: low
sources: ["[[hackaday-end-of-ondsel]]", "[[ondsel-shutdown-announcement]]"]
category: tool
---

# FreeCAD

> The main open-source parametric mechanical CAD system, and the only realistic substrate
> for a fully open design-collaboration stack.

## What it is

An open-source parametric modeler built on the Open CASCADE geometry kernel. Relevant here
because it is the one mainstream CAD system whose native format and feature tree are
inspectable — which is a precondition for diffing anything other than final geometry
[[parametric-feature-history]].

## Key facts

| Fact | Source | As of |
|---|---|---|
| Received ~150 PRs from the Ondsel team, largely landing in 1.0 | [[hackaday-end-of-ondsel]] | 2024-11-12 |
| Users report models breaking after minor edits | [[hackaday-end-of-ondsel]] | 2024-11-12 |
| Interaction paradigm criticized as CATIA-influenced and confusing | [[hackaday-end-of-ondsel]] | 2024-11-12 |

## History

Long-running community project; 1.0 released after absorbing Ondsel's contributions.

## Open questions

- What exactly is the topological naming problem, and is it fatal for feature-tree diffing?
  The community complaint about "models breaking after minor edits" is almost certainly
  this, but no source in the wiki names it yet — a gap.
- What is the internal structure of `.FCStd`, and is it diffable? (It is a zip of XML plus a
  BREP blob — **unverified**, from background knowledge.)

## Related

- [[ondsel]] — the company that tried to commercialize it
- [[parametric-feature-history]] — the thing FreeCAD exposes that proprietary CAD does not
