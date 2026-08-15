---
type: source
title: GitHub Docs — 3D File Viewer
created: 2026-08-15
updated: 2026-08-15
tags: [github, stl, rendering, prior-art]
status: active
confidence: high
sources: []
raw: raw/2026-08-15-github-3d-file-viewer-docs.md
origin: https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files
author: GitHub
published: null
kind: doc
---

# GitHub Docs — 3D File Viewer

> Vendor documentation establishing exactly how far the literal "GitHub for STL" answer
> already goes: render-only, one format, 10 MB ceiling, no diff.

## Summary

GitHub's documentation states that "GitHub can host and render 3D files with the *.stl*
extension." STL is the only supported 3D format. Files over 10 MB are not displayed:
"files that are larger than 10 MB are too big for GitHub to display." Interactions are
rotate, pan, zoom, and view-mode switching.

The documentation describes no version-comparison capability for 3D files. It is a viewer,
not a diff.

## Key claims

| Claim | Evidence given | My confidence |
|---|---|---|
| STL is the only rendered 3D format | Stated in docs | high — first-party |
| 10 MB display ceiling | Stated in docs | high — first-party |
| No visual diff for 3D files | Absence of any such feature in the docs | medium-high — argument from silence, but the docs are thorough elsewhere |

## What this changes in the wiki

- **Confirms:** [[what-prior-art-exists-for-github-for-cad]] — the naive answer ("just use
  GitHub") is real but shallow.
- **Extends:** [[geometry-diffing]] — the missing capability is precisely diff, which is the
  hard part and the part nobody shipped.
- **Extends:** [[git-lfs]] — the 10 MB render ceiling is well below typical production mesh
  sizes, so GitHub's viewer degrades exactly where real files live.

## Notable details

The 10 MB ceiling matters more than it looks. Hobby-scale STLs sit comfortably under it;
scanned or production meshes routinely do not. So the free capability covers the segment
with the least willingness to pay — see [[who-pays-for-cad-collaboration]].

## Questions raised

- What is the actual size distribution of STL files people want to version? This is
  answerable by sampling a consumer repository and is worth doing before choosing storage
  architecture.

## Related

- [[github-3d-file-viewer]] — the entity page
- [[geometry-diffing]] — what GitHub does not do
- [[what-prior-art-exists-for-github-for-cad]] — the survey this feeds
