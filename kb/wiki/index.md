---
type: overview
title: Index
created: 2026-08-11
updated: 2026-08-15
tags: [meta]
status: active
confidence: high
sources: []
---

# Index

The catalog of every page in this wiki. Read this first when answering a question, then
drill into the pages it points at. Agent: update this in the same pass as any page creation
or rename — a page missing from here is effectively invisible.

Format: one bullet per page — a wikilink, an em dash, a one-sentence summary, then the
number of sources backing it in parentheses.

## Overview

- [[overview]] — the current synthesis and thesis. Start here. (2 sources)
- [[log]] — chronological record of every ingest, query, and lint. (0 sources)

## Concepts

- [[cad-files-as-compiled-artifacts]] — **the central thesis**: shared design files are build outputs, not source, so software version control does not transfer. (3 sources)
- [[geometry-diffing]] — computing and showing what changed between two 3D revisions; the core technical problem, with five candidate approaches ranked. (3 sources)
- [[parametric-feature-history]] — the feature tree is CAD's closest thing to source code; no interchange format carries it, and topological naming destabilizes it. (2 sources)
- [[neutral-exchange-formats]] — the STL / 3MF / IGES / STEP fidelity ladder and what each rung drops. (2 sources)
- [[cloud-lock-in-in-cad]] — collaboration features live in vendor data models, not files; real, but an accelerant rather than the root cause. (2 sources)
- [[ecad-mcad-versioning-asymmetry]] — why electronics got working collaboration tooling first: projectability, discrete structure, and the BOM. (3 sources)
- [[pdm-and-plm]] — the incumbent, organization-scoped answer to design version control. **Thinly sourced.** (2 sources)
- [[remix-graphs-vs-version-control]] — consumer remix lineage looks like forking and lacks every feature that matters. **Thinly sourced.** (1 source)

## Questions

- [[is-cloud-lock-in-the-root-cause]] — no: the formats were lossy before the cloud, and removing lock-in has been tried. Medium confidence. (4 sources)
- [[who-pays-for-cad-collaboration]] — **highest-risk open question.** Unresolved; willingness to pay appears inverted across segments. (4 sources)
- [[what-is-the-right-primary-artifact]] — STL, STEP, native, feature tree, or a derived representation? Open; derived-representation hypothesis leading. (3 sources)
- [[what-prior-art-exists-for-github-for-cad]] — six tiers of prior art; cross-platform mechanical is the empty cell. (6 sources)

## Entities

- [[onshape]] — cloud-native MCAD with real branching and merging, available only inside its own platform. (2 sources)
- [[allspice]] — Git for electronics hardware with automatic visual diffs; the closest working "GitHub for hardware." (2 sources)
- [[ondsel]] — 2022-2024 attempt at open mechanical CAD collaboration; shut down. The most relevant precedent. (2 sources)
- [[github-3d-file-viewer]] — GitHub's STL renderer: one format, 10 MB ceiling, no diff. (1 source)
- [[git-lfs]] — makes the wrong thing cheap to store; solves clone size, not comprehension. (2 sources)
- [[freecad]] — the one open parametric CAD system with an inspectable feature tree. **Stub.** (2 sources)
- [[cadlab-io]] — PCB version control and visual collaboration; competitor to AllSpice. **Stub, unverified.** (1 source)
- [[solidworks]] — the desktop incumbent whose proprietary format defines the interop problem. **Stub.** (1 source)
- [[autodesk-fusion]] — cloud-attached MCAD, midpoint between desktop and cloud-native. **Stub.** (1 source)

## Decisions

_None yet._ Candidate to promote once tested: the derived-representation hypothesis in
[[what-is-the-right-primary-artifact]].

## Sources

- [[conversation-cad-sharing-problem]] — the conversation that produced the thesis; 2026-08-15. (conversation)
- [[ondsel-shutdown-announcement]] — Ondsel's own post-mortem: ~100 engineer interviews, no commercial adoption found. (article, 2024-11)
- [[hackaday-end-of-ondsel]] — third-party coverage plus an insider's dissent on why it failed. (article, 2024-11-12)
- [[onshape-git-style-version-control]] — vendor account of branching, merging, and branch comparison in Onshape. (article)
- [[allspice-git-for-hardware-pros-cons]] — the sharpest statement of why Git fails on binary design files. (article)
- [[techcrunch-allspice-series-a]] — AllSpice's $6M round, traction figures, SMB-to-enterprise pivot. (article, 2023-12-05)
- [[capvidia-step-application-protocols]] — STEP AP203 vs AP214 vs AP242, and what neutral export loses. (article)
- [[github-3d-file-viewer-docs]] — GitHub's STL rendering: formats, 10 MB limit, no diff. (doc)
