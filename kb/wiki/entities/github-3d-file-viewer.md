---
type: entity
title: GitHub 3D File Viewer
created: 2026-08-15
updated: 2026-08-15
tags: [github, stl, rendering, prior-art]
status: active
confidence: high
sources: ["[[github-3d-file-viewer-docs]]"]
category: service
---

# GitHub 3D File Viewer

> GitHub's built-in in-browser renderer for `.stl` files: the literal answer to "is there a
> GitHub for STL," and a useful measure of how little that answer covers.

## What it is

A viewer embedded in GitHub's file view that renders STL geometry with rotate, pan, zoom,
and view-mode controls [[github-3d-file-viewer-docs]].

## Key facts

| Fact | Source | As of |
|---|---|---|
| STL is the only supported 3D format | [[github-3d-file-viewer-docs]] | 2026-08-15 |
| Files over 10 MB are not displayed | [[github-3d-file-viewer-docs]] | 2026-08-15 |
| No visual diff between versions | [[github-3d-file-viewer-docs]] | 2026-08-15 |

## How it works / what it does

Render-only. There is no comparison mode, so a repository of STLs on GitHub gives you
storage, history, and a preview — but every revision is an opaque new blob, and reviewing a
change means downloading both versions and opening them elsewhere.

The 10 MB ceiling is the sharper limitation: it excludes most scanned and production meshes,
so the capability covers precisely the hobby-scale segment least likely to pay
[[who-pays-for-cad-collaboration]].

## History

Shipped in 2013 and essentially unchanged since — no diff, no additional formats. Over a
decade of no investment is itself evidence about how GitHub views this workload.
(Ship date is **unsourced** background knowledge; the stagnation claim is inference from the
current docs.)

## Open questions

- What is the real size distribution of STLs people want to version? Sampling a consumer
  repository would answer it and would directly inform storage design.

## Related

- [[git-lfs]] — how people actually store these files
- [[geometry-diffing]] — the missing half
- [[what-prior-art-exists-for-github-for-cad]] — the survey
