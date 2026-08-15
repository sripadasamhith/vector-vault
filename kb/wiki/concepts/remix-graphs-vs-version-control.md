---
type: concept
title: Remix Graphs vs Version Control
created: 2026-08-15
updated: 2026-08-15
tags: [consumer, stl, attribution, forking]
status: active
confidence: low
sources: ["[[conversation-cad-sharing-problem]]"]
---

# Remix Graphs vs Version Control

> Consumer 3D model sites implement social forking — attribution lineage between separately
> uploaded files — which looks like version control and is not.

## The idea

Printables, MakerWorld, Thangs, and the earlier Thingiverse all support "remixes": a user
downloads a model, modifies it, uploads the result, and the platform records a link back to
the original [[conversation-cad-sharing-problem]]. The result is a directed graph of
derivation.

What it shares with version control: lineage, attribution, and a notion of derivation.

What it lacks, and the differences are all the load-bearing ones:

- **No diff.** Nothing shows what the remixer actually changed.
- **No merge.** Improvements cannot flow back to the original.
- **No commits.** A remix is one upload, not a history.
- **No identity between revisions.** Uploading v2 typically replaces or duplicates rather
  than committing.

So the remix graph is a *social* structure — credit and discovery — layered on files that
remain, per [[cad-files-as-compiled-artifacts]], opaque artifacts.

## Why it matters here

Two lessons, pulling in opposite directions:

1. **Attribution is a solved-enough problem and a weak differentiator.** Vector Vault should
   not spend effort re-implementing remix trees.
2. **The consumer segment demonstrably wants lineage** and has adopted it at scale. That is
   real evidence of demand for *something* in this space — but it is the segment with the
   least willingness to pay, per [[who-pays-for-cad-collaboration]], and the platforms
   monetize through printer hardware and marketplaces rather than through the tooling.

## Mechanism / how it works

Unverified in detail. Typically: the uploader declares a source URL, the platform links the
pages, and licence obligations (often Creative Commons) propagate. Whether any platform
computes derivation from the geometry itself rather than trusting the declaration is
**unknown and worth checking** — Thangs is the likely candidate, since its differentiator is
geometric search.

## Evidence

| Claim | Support | Against | Confidence |
|---|---|---|---|
| Consumer platforms implement remix lineage | [[conversation-cad-sharing-problem]] | — | medium — asserted from familiarity, no platform docs fetched |
| Remix lineage lacks diff and merge | same | — | medium |
| Thangs does geometric similarity search | search-result taglines only | — | low — **needs verification** |

## Instances

- Printables, MakerWorld, Thangs, Thingiverse — **no entity pages yet**, and no primary
  sources read. Flagged as a gap.

## Limits and failure modes

- This page is built almost entirely on background familiarity rather than fetched sources.
  It is the weakest-sourced page in the wiki alongside [[pdm-and-plm]].
- **Do not conclude the consumer segment does not matter.** It is where the volume of STL
  files and the cultural expectation of sharing already exist. Dismissing it because it
  cannot pay directly would be the same mistake as assuming it can.

## Contradictions

None recorded.

## Related

- [[cad-files-as-compiled-artifacts]] — why remixing cannot flow back upstream
- [[who-pays-for-cad-collaboration]] — the monetization problem in this segment
- [[geometry-diffing]] — what would turn a remix graph into real version control
