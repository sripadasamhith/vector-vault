---
type: entity
title: Git LFS
created: 2026-08-15
updated: 2026-08-15
tags: [git, storage, binary-files, prior-art]
status: stub
confidence: medium
sources: ["[[allspice-git-for-hardware-pros-cons]]", "[[conversation-cad-sharing-problem]]"]
category: tool
---

# Git LFS

> Git Large File Storage: replaces big binaries in a repository with text pointers and
> stores the blobs separately. The standard workaround for putting CAD in Git, and a
> storage fix that leaves the actual problem untouched.

## What it is

An extension that keeps repository history light by storing large binary files out of band.
It is what teams reach for when they try to version CAD in Git
[[conversation-cad-sharing-problem]].

## Key facts

| Fact | Source | As of |
|---|---|---|
| Does not enable diffing or merging of binary design files | [[allspice-git-for-hardware-pros-cons]] | 2026-08-15 |

## How it works / what it does

LFS solves *clone size*. It does not touch the reasons binary design files resist version
control: no meaningful diff, no three-way merge, and no way to attribute interwoven changes
to separate authors [[allspice-git-for-hardware-pros-cons]]. Every commit is still a whole
new opaque blob.

Framing that matters for this project: **LFS makes the wrong thing cheap to store.** If
Vector Vault's answer is "LFS plus a viewer," it inherits all of these limits — see
[[cad-files-as-compiled-artifacts]].

## Open questions

- What are practical LFS cost and performance characteristics at, say, 10k revisions of
  50 MB meshes? Unknown; matters for storage architecture.
- Do content-defined chunking schemes (e.g. restic/borg-style) beat LFS for mesh data,
  where small geometric edits can perturb the whole serialization? **Unverified** — this is
  a hypothesis worth testing early.

## Related

- [[github-3d-file-viewer]] — the other half of the naive GitHub answer
- [[geometry-diffing]] — what LFS conspicuously does not provide
