---
type: overview
title: Overview
created: 2026-08-11
updated: 2026-08-15
tags: [meta]
status: active
confidence: medium
sources: ["[[conversation-cad-sharing-problem]]", "[[cad-files-as-compiled-artifacts]]"]
---

# Overview

The front door to this wiki and its current synthesis. Rewritten as understanding changes —
it reflects what we believe *now*, not a running history.

## Scope

**Covers:** the problem space Vector Vault sits in — how design files are shared and
versioned, what CAD and mesh formats do and do not carry, how geometry can be diffed, the
prior art (commercial and open), and the market structure around it. Also, as it gets built,
the system itself and the rationale behind its design.

**Does not cover:** CAD modeling technique, 3D printing process, geometry-kernel
implementation beyond what bears on diffing, or general Git usage.

## Current picture

The question that started this wiki: *are there GitHub equivalents for `.stl` design files,
and is it true that cloud-based design tools make sharing hard?*

The short version of what we found:

- **Partial equivalents exist, none complete.** GitHub renders STL under 10 MB with no diff
  [[github-3d-file-viewer-docs]]. [[onshape]] has real branching and merging, only inside its
  own cloud [[onshape-git-style-version-control]]. [[allspice]] and [[cadlab-io]] have
  working Git-plus-visual-diff for electronics. Consumer sites have remix graphs, not
  version control [[remix-graphs-vs-version-control]]. Cross-platform mechanical CAD is the
  empty cell — see [[what-prior-art-exists-for-github-for-cad]].
- **The pain is real.** Cross-company collaboration does degrade to emailing STEP and STL
  files, and version history is a platform feature rather than a file property
  [[cloud-lock-in-in-cad]].
- **The usual diagnosis is wrong.** Cloud lock-in is an accelerant, not the root cause —
  see the thesis below and [[is-cloud-lock-in-the-root-cause]].
- **The commercial risk exceeds the technical risk.** [[ondsel]] built close to this and shut
  down after failing to find buyers [[ondsel-shutdown-announcement]], while [[allspice]]
  raised and grew in electronics [[techcrunch-allspice-series-a]]. The most plausible
  difference so far: AllSpice never asked anyone to change CAD tools.

## Thesis

**CAD files are compiled artifacts, not source.** What gets shared is the evaluated output
of a modeling process, with the authoring history discarded. STL is the extreme case:
triangle soup with no parametrics, no assembly structure, no design intent. STEP is better
but still "represents standardized data subsets rather than complete native feature
histories or parametric design intent" [[capvidia-step-application-protocols]].

Everything follows from that. Merge is intractable because changes are interwoven in opaque
binaries — a point AllSpice makes exactly: "This isn't a downside of Git, this is a downside
of the ECAD file formats" [[allspice-git-for-hardware-pros-cons]]. Diff is unsolved because
there is no canonical unit to align. Vendors can hold collaboration hostage because design
intent only exists in their representation. And a fully local-first, open-licence CAD world
would still have none of diff, merge, or a shared semantic layer.

So the interesting problem is not storage or hosting. It is **deciding what to put under
version control and computing a legible difference over it** —
[[what-is-the-right-primary-artifact]] and [[geometry-diffing]].

Corollary worth stating plainly: a product that versions STL files is versioning build
outputs. It can offer storage, history, and preview. It cannot offer diff, merge, or reuse
without computing something new on top.

### How the thesis has moved

| Date | Shift | Trigger |
|---|---|---|
| 2026-08-15 | Initial thesis: compiled-artifact framing; cloud lock-in demoted from cause to accelerant | [[conversation-cad-sharing-problem]] plus the first seven sources |

## Open questions

- [[is-cloud-lock-in-the-root-cause]] — framing. Current answer: no, it is an accelerant.
- [[who-pays-for-cad-collaboration]] — **the highest-risk question.** Unresolved.
- [[what-is-the-right-primary-artifact]] — the core product decision. Open.
- [[what-prior-art-exists-for-github-for-cad]] — survey, one pass deep, incomplete.
- [[what-should-we-build-first]] — the sequencing question. What the above implies for Monday.

## Contradictions and tensions

1. **Why Ondsel died.** Its own post says commercial demand was absent
   [[ondsel-shutdown-announcement]]; an insider says the segment was mis-chosen
   [[hackaday-end-of-ondsel]]. Unresolved, tracked in [[who-pays-for-cad-collaboration]].
2. **Ondsel vs AllSpice.** Same category, opposite outcomes. Explanations on the table:
   format structure ([[ecad-mcad-versioning-asymmetry]]), segment, or the tool-switch
   requirement. The third is currently the most plausible and the least examined.
3. **Onshape's existence.** It undercuts "MCAD version control is impossible" — it exists and
   ships. It supports "MCAD version control is impossible *across vendors*," which is the
   claim this wiki actually makes.

## Known gaps

Named honestly, because they bound how much this synthesis is worth:

- PDM/PLM incumbents almost entirely unresearched — [[pdm-and-plm]] is nearly all reasoning.
- GrabCAD Workbench, Upchain, Duro, Wikifactory, Ganister not surveyed at all.
- Consumer platforms asserted from familiarity, no primary sources —
  [[remix-graphs-vs-version-control]].
- Claims about Autodesk Fusion and Dassault 3DEXPERIENCE cloud posture are **unsourced**.
- No user contact whatsoever. Every demand-side claim is inference.

## Related

- [[index]] — the full catalog of pages
- [[cad-files-as-compiled-artifacts]] — the thesis in full
- [[log]] — chronological history of this wiki
