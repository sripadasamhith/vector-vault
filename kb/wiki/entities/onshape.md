---
type: entity
title: Onshape
created: 2026-08-15
updated: 2026-08-15
tags: [cad, cloud-cad, competitor, prior-art]
status: active
confidence: medium
sources: ["[[onshape-git-style-version-control]]", "[[conversation-cad-sharing-problem]]"]
category: service
---

# Onshape

> A cloud-native mechanical CAD system, owned by PTC, that is the only mainstream MCAD tool
> shipping real Git-style branching and merging — available exclusively inside its own
> platform.

## What it is

A browser-delivered parametric CAD system with a document model designed around versions
and branches rather than files. It is the closest existing thing to the Vector Vault
concept, and simultaneously the strongest example of the lock-in the concept is reacting
to — see [[cloud-lock-in-in-cad]].

## Key facts

| Fact | Source | As of |
|---|---|---|
| Supports branching: "an isolated workspace for experimentation" | [[onshape-git-style-version-control]] | 2026-08-15 |
| Claims branch differences are visualized "just like GitHub does for software code" | [[onshape-git-style-version-control]] | 2026-08-15 |
| Supports protected workspaces with controlled review and merge | [[onshape-git-style-version-control]] | 2026-08-15 |
| Multi-user simultaneous editing, Google Docs-style | [[onshape-git-style-version-control]] | 2026-08-15 |
| Cloud-only delivery, no local-file mode | (unsourced — widely known, not verified in this session) | 2026-08-15 |

## How it works / what it does

Onshape can offer branch and merge because it controls the whole stack: the geometry
kernel, the document model, and the storage. Version history is a property of the *server's
data model*, not of an exported file. This is exactly why it works and exactly why it does
not travel — see [[geometry-diffing]] and [[cad-files-as-compiled-artifacts]].

## History

Founded by ex-SolidWorks leadership; acquired by PTC. The version-control framing appears
to have grown from a differentiator into the primary marketing story.

## Contradictions

None recorded. The vendor blog is the only source on this entity so far, so everything here
is single-sourced vendor material and should be treated accordingly.

## Open questions

- Is branch/merge history exportable in any form? Not addressed by the source.
- How does merge behave on conflicting topology rather than disjoint feature edits?
- What is the actual export fidelity to STEP AP242? See [[neutral-exchange-formats]].

## Related

- [[cloud-lock-in-in-cad]] — Onshape is the central case
- [[geometry-diffing]] — the capability it claims to have solved in-platform
- [[what-prior-art-exists-for-github-for-cad]] — the survey it anchors
