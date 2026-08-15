---
type: source
title: Onshape — Git-Style Version Control
created: 2026-08-15
updated: 2026-08-15
tags: [onshape, branching, merging, cloud-cad, vendor-content]
status: active
confidence: medium
sources: []
raw: raw/2026-08-15-onshape-git-style-version-control.md
origin: https://www.onshape.com/en/blog/git-style-version-control-cad-data-management
author: Onshape (PTC)
published: null
kind: article
---

# Onshape — Git-Style Version Control

> Vendor marketing, but load-bearing evidence: it documents that real branch/merge for
> mechanical CAD has already shipped — inside one proprietary cloud.

## Summary

Onshape argues that file-based CAD workflows have barely changed since drive-letter file
management, and that its cloud-native model brings Git semantics to mechanical design. It
claims three capabilities: **instant branching** ("an isolated workspace for
experimentation"), **precision merging** where the platform "clearly visualizes differences
between branches, just like GitHub does for software code" with selective adoption of
changes, and **workspace protection** enforcing a "controlled review and merge process."

It frames the cost of file-based CAD as cost of change ("tedious file duplications, manual
conflict resolution, and hours spent fixing broken references") and cost of delay ("only
one person can work on a design at a time"). The collaboration model is pitched as Google
Docs-like simultaneous editing.

## Key claims

| Claim | Evidence given | My confidence |
|---|---|---|
| Onshape supports real branching and merging of CAD | Vendor description; feature exists in product | high that the feature exists; unverified how well merge handles conflicting topology |
| Differences between branches are visualized like GitHub | Vendor assertion | medium — no screenshots or algorithm detail in the extract |
| File-based CAD serializes work to one editor at a time | Vendor assertion about competitors | medium — true of classic check-in/check-out PDM, overstated as a blanket claim |

## What this changes in the wiki

- **Confirms:** [[cloud-lock-in-in-cad]] — the strongest version-control story in mechanical
  CAD is also the most locked-in delivery model. That is the central irony of this space.
- **Extends:** [[geometry-diffing]] — visual branch comparison is solvable when you control
  the kernel and the document model. The hard version is doing it *across* vendors.
- **Extends:** [[onshape]].

## Notable details

The extract contains **no** statement about exporting branch/merge history, and nothing
about what survives when a document leaves Onshape. That silence is the finding: version
history is a property of the platform, not of the file. Explicitly flagged as unverified
rather than asserted.

## Questions raised

- Can Onshape's branch/merge history be exported in any form? If not, every Onshape team is
  a data-migration hostage, which is a potential wedge for Vector Vault.
- How does Onshape's merge behave on genuinely conflicting topology, rather than on
  edits to disjoint features? The marketing does not say.

## Related

- [[onshape]] — the entity
- [[cloud-lock-in-in-cad]] — the tension this source embodies
- [[geometry-diffing]] — the capability being claimed
