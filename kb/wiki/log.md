---
type: overview
title: Log
created: 2026-08-15
updated: 2026-08-15
tags: [meta]
status: active
confidence: high
sources: []
---

# Log

Append-only. Newest entries at the bottom. Never rewrite a past entry.

Every entry header must match `## [YYYY-MM-DD] <op> | <subject>` where `<op>` is one of
`ingest`, `query`, `lint`, `decision`, `capture`, so that the log stays greppable:

```
grep "^## \[" kb/wiki/log.md | tail -20
```

---

## [2026-08-15] capture | wiki initialized for Vector Vault

- Installed the llm-wiki template into `kb/`. Paths in `kb/AGENTS.md` and `kb/CLAUDE.md`
  rewritten to be relative to the repo root.
- Project block filled in: subject Vector Vault ("GitHub for CAD"), mode mixed, purpose
  covering rationale recovery, onboarding, defensible tradeoffs, and tracking the space.
- Mixed mode — both domain profiles (technical and research) kept in `kb/AGENTS.md`.
- Seed pages reset for this project: `overview.md`, `index.md`, `log.md`.
- No sources ingested yet; `kb/raw/` is empty.

## [2026-08-15] ingest | CAD version control landscape — 8 sources

Triggered by the question "are there GitHub equivalents for .stl files, and is cloud
lock-in why sharing is hard?" Answered in conversation first, then ingested.

- **Filed 8 raw sources** in `kb/raw/`: Ondsel's shutdown post, Hackaday's coverage of it,
  GitHub's 3D file viewer docs, Onshape's Git-style version control blog, AllSpice's "Git
  for hardware" post, TechCrunch on AllSpice's $6M round, Capvidia on STEP application
  protocols, and a write-up of the conversation itself.
  **Caveat recorded in every raw file:** these are WebFetch-produced extracts, not
  byte-faithful mirrors. Wording is approximate outside quotation marks.
- **Created 8 source pages** in `wiki/sources/`, one per raw source.
- **Created 8 concept pages:** [[cad-files-as-compiled-artifacts]] (the thesis),
  [[geometry-diffing]], [[parametric-feature-history]], [[neutral-exchange-formats]],
  [[cloud-lock-in-in-cad]], [[ecad-mcad-versioning-asymmetry]], [[pdm-and-plm]],
  [[remix-graphs-vs-version-control]].
- **Created 4 question pages:** [[is-cloud-lock-in-the-root-cause]],
  [[who-pays-for-cad-collaboration]], [[what-is-the-right-primary-artifact]],
  [[what-prior-art-exists-for-github-for-cad]].
- **Created 9 entity pages:** [[onshape]], [[allspice]], [[ondsel]], [[cadlab-io]],
  [[freecad]], [[github-3d-file-viewer]], [[git-lfs]], [[solidworks]], [[autodesk-fusion]].
  The last four are stubs.
- **Rewrote [[overview]]** from template stub to a real synthesis with a stated thesis and a
  Known Gaps section. **Rebuilt [[index]]** to catalog all 32 pages.
- **Contradiction recorded:** Ondsel's post-mortem blames absent demand
  [[ondsel-shutdown-announcement]]; an Ondsel team member blames segment choice
  [[hackaday-end-of-ondsel]]. Both 2024-11. Unresolved, tracked in
  [[who-pays-for-cad-collaboration]].
- **Tension recorded:** Ondsel died in MCAD while AllSpice raised in ECAD. A confound runs
  through it — Ondsel required switching CAD tools, AllSpice required switching nothing.
  Currently the leading explanation and the least examined.
- **Gaps flagged for the next pass:** PDM/PLM incumbents unresearched; GrabCAD Workbench,
  Upchain, Duro, Wikifactory, Ganister not surveyed; consumer platforms unsourced; Autodesk
  and Dassault cloud-posture claims marked `(unsourced)`; `bdlucas1/diff3d` identified as
  the single highest-value unread source; no user contact at all.
