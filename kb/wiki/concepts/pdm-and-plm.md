---
type: concept
title: PDM and PLM
created: 2026-08-15
updated: 2026-08-15
tags: [pdm, plm, incumbent, org-boundary]
status: active
confidence: low
sources: ["[[allspice-git-for-hardware-pros-cons]]", "[[onshape-git-style-version-control]]"]
---

# PDM and PLM

> Product Data Management and Product Lifecycle Management: the incumbent enterprise answer
> to design version control. Organization-scoped by design, which is exactly why it does not
> solve cross-company sharing.

## The idea

PDM manages CAD files inside a company — check-in/check-out, revisions, where-used,
approvals. PLM wraps that in the wider product lifecycle: BOMs, change orders, ERP
integration, release and compliance workflows.

Two things follow. First, **the incumbent is not absent**: any pitch that says "engineers
have no version control" is wrong, and enterprises hear it as ignorance. Second, the
incumbent's scope is the *organization*. PLM assumes one company's users, one permission
model, one set of processes. The problem Sam's friend described happens precisely at the
boundary PLM does not cross [[conversation-cad-sharing-problem]].

AllSpice's framing is useful here: Git and PLM are not substitutes — Git lacks ERP
integration and release management, so "many organizations maintain both"
[[allspice-git-for-hardware-pros-cons]].

## Why it matters here

Three consequences for positioning:

1. Competing with PLM head-on means competing with a procurement process, not a product.
2. The unserved space is *inter*-organizational, plus the small teams below PLM's price
   floor — the segment [[hackaday-end-of-ondsel]] argues was Ondsel's real market.
3. Being complementary to PLM (a review and exchange layer, not a system of record) is a
   more defensible position than replacing it.

## Mechanism / how it works

Classic PDM serializes editing through check-in/check-out locking. Onshape attacks exactly
this, characterizing file-based workflow as one where "only one person can work on a design
at a time" [[onshape-git-style-version-control]] — a vendor characterization of a
competitor, so discount accordingly, though it does describe how locking-based PDM works.

## Evidence

| Claim | Support | Against | Confidence |
|---|---|---|---|
| Git does not replace PLM; orgs run both | [[allspice-git-for-hardware-pros-cons]] | — | medium-high |
| PDM/PLM is organization-scoped | (unsourced — definitional, but **no source in the wiki yet**) | — | low |
| Classic PDM serializes edits via locking | [[onshape-git-style-version-control]] | vendor source about a competitor | low-medium |

## Instances

- SOLIDWORKS PDM, Windchill, Teamcenter, Arena — **no pages yet, and no sources read.** This
  is the largest gap in the wiki: the incumbent category is the least researched.

## Limits and failure modes

- This page is currently the thinnest in the wiki and is mostly reasoning. Treat every claim
  as provisional until primary sources are ingested.

## Contradictions

None recorded — largely because almost nothing has been read on this topic.

## Related

- [[cloud-lock-in-in-cad]] — the other incumbent constraint
- [[who-pays-for-cad-collaboration]] — PLM is who already has the budget
- [[allspice]] — positions alongside PLM rather than against it
