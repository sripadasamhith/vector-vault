---
type: overview
title: Overview
created: 2026-08-15
updated: 2026-08-15
tags: [meta]
status: stub
confidence: low
sources: []
---

# Overview

The front door to this wiki and its current synthesis. This page is rewritten as
understanding changes — it should always reflect what we believe *now*, not a running
history.

## Scope

This wiki covers **Vector Vault**, a version-control and collaboration platform for CAD
and 3D model files (STL and related formats) — "GitHub for CAD."

Two things are in scope, and the wiki deliberately holds both:

- **The system being built** — architecture, components, decisions and their rationale,
  invariants, failure modes.
- **The problem space it sits in** — mesh and CAD file formats, diffing and versioning
  binary geometry, storage, rendering, and prior art in the space.

Out of scope: general 3D modeling technique, and CAD authoring itself. We care about
formats and files as objects to store, diff, and version — not about how to design a part.

## Current picture

_Nothing ingested yet. This section gets its first real content on the first ingest._

## Thesis

_Mixed mode, so this section carries both: the current mental model of how Vector Vault
works, and the current position on the open design bets (what to diff on, what a "commit"
means for a mesh, where the hard tradeoffs are). Stated plainly enough to be wrong._

Nothing established yet.

### How the thesis has moved

| Date | Shift | Trigger |
|---|---|---|
| 2026-08-15 | Initial — no position yet | Wiki initialized |

## Open questions

_The biggest things we don't know. Link to pages in `kb/wiki/questions/` as they're
created._

None filed yet. Likely first candidates, from the framing above: what a meaningful diff
between two meshes actually is, and what prior art already solves.

## Contradictions and tensions

_Unresolved disagreements between sources. Not noise — track them._

None yet.

## Related

- [[index]] — the full catalog of pages
