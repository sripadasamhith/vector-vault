---
type: source
title: Hackaday — The End Of Ondsel
created: 2026-08-15
updated: 2026-08-15
tags: [open-source-cad, freecad, business-model, commentary]
status: active
confidence: medium
sources: []
raw: raw/2026-08-15-hackaday-end-of-ondsel.md
origin: https://hackaday.com/2024/11/12/the-end-of-ondsel-and-reflecting-on-the-commercial-prospects-for-freecad/
author: Hackaday
published: 2024-11-12
kind: article
---

# Hackaday — The End Of Ondsel

> Third-party coverage of the Ondsel shutdown, useful mainly for the dissenting comment
> from an Ondsel team member and for the community's account of why FreeCAD is hard to
> adopt professionally.

## Summary

Hackaday reports the shutdown and reads it as "ending for now the prospect of FreeCAD
playing in the big leagues," concluding "the business case was not strong enough" to
attract commercial partners. The comment thread is the more interesting half.

Aleksandr Prokudin, an Ondsel team member, disputes the framing. He notes "~150 pull
requests with new features, improvements, and fixes" from Ondsel landed in FreeCAD (largely
in 1.0), and argues the realistic market was never enterprise displacement but "smaller
teams that are new ideas and aren't married to specific software."

Commenters raise recurring FreeCAD complaints: a confusing CATIA-influenced interaction
paradigm, and models breaking after minor edits — the **topological naming problem**, though
the extract does not name it. One professional calls FreeCAD an "unnecessarily obtuse piece
of software."

## Key claims

| Claim | Evidence given | My confidence |
|---|---|---|
| ~150 Ondsel PRs merged into FreeCAD | First-hand from an Ondsel team member | high |
| The addressable market was small unopinionated teams, not enterprises | Assertion by an insider | medium — motivated, but the sharper hypothesis |
| FreeCAD models break on minor edits | Multiple anecdotal user reports | medium — well-known issue, but anecdotal here |

## What this changes in the wiki

- **Confirms:** [[ondsel-shutdown-announcement]] — same event, consistent account.
- **Extends:** [[who-pays-for-cad-collaboration]] — introduces the counter-hypothesis that
  the segment was mis-chosen rather than absent.
- **Extends:** [[freecad]] — reliability and UX as adoption blockers independent of
  collaboration tooling.

## Notable details

Prokudin's disagreement with the article is itself a first-class object: the article says
the market was not there; the insider says the market was there but was not enterprises.
These are meaningfully different conclusions from the same shutdown. Kept as a tension in
[[who-pays-for-cad-collaboration]] rather than averaged away.

## Questions raised

- Is the topological naming problem a blocker for *any* system that wants to diff parametric
  history rather than final geometry? See [[parametric-feature-history]].

## Related

- [[ondsel]] — the company
- [[ondsel-shutdown-announcement]] — the primary account
- [[freecad]] — the underlying CAD system
