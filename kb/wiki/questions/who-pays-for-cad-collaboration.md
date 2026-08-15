---
type: question
title: Who Pays for CAD Collaboration Tooling?
created: 2026-08-15
updated: 2026-08-15
tags: [business-model, segmentation, willingness-to-pay]
status: active
confidence: low
sources: ["[[ondsel-shutdown-announcement]]", "[[hackaday-end-of-ondsel]]", "[[techcrunch-allspice-series-a]]", "[[allspice-git-for-hardware-pros-cons]]"]
---

# Who Pays for CAD Collaboration Tooling?

> Which segment has both the pain and the budget: hobbyists, small hardware teams,
> mid-market manufacturers, or enterprises that already own PLM?

## Why it matters

This is the question that killed the closest precedent. [[ondsel]] had the technology and
the open-source goodwill and still could not find buyers
[[ondsel-shutdown-announcement]]. Getting the segment wrong is the dominant failure mode in
this category — ahead of any technical risk.

## Current answer

**Unresolved, and the wiki's most important open question.** Confidence: low.

What the evidence shows is an apparent inversion: the segments that feel the pain most
acutely (makers, small shops, cross-company collaborators) can pay least, and the segment
that can pay most (enterprises) has already bought PLM
[[conversation-cad-sharing-problem]], [[pdm-and-plm]].

Two sources point in opposite directions:

- **Ondsel (mechanical, open-source, prosumer):** ~100 engineer interviews, two years, and
  they "failed to find commercial adoption to justify a venture-capitalized startup"
  [[ondsel-shutdown-announcement]].
- **AllSpice (electronics, enterprise, works with existing tools):** $6M on top of a $3.2M
  seed, company-reported 10x YoY growth, and a deliberate SMB-to-enterprise pivot after
  finding large organizations had the same problems
  [[techcrunch-allspice-series-a]].

The most useful single number found so far: AllSpice reports each engineer bringing **2-3
collaborators from other teams** within 4-6 months
[[techcrunch-allspice-series-a]]. Collaboration tooling spreads across team boundaries
inside a company — which is the same shape as the cross-company problem, one boundary in,
and suggests where a wedge could start.

## Evidence for "enterprises pay, and only for tools that fit existing workflows"

- AllSpice's SMB-to-enterprise pivot was reported as necessary — [[techcrunch-allspice-series-a]]
- AllSpice works with the ECAD tools teams already own; nobody had to switch design tools
  — [[allspice-git-for-hardware-pros-cons]]
- Git does not replace PLM, so orgs buy both rather than substituting —
  [[allspice-git-for-hardware-pros-cons]]

## Evidence for "the market is small unopinionated teams"

- An Ondsel team member argues the real market was "smaller teams that are new ideas and
  aren't married to specific software," not enterprises — [[hackaday-end-of-ondsel]]

## The unresolved contradiction

Ondsel's own post says the demand was not there
[[ondsel-shutdown-announcement]]; an Ondsel insider says the demand was there but the
segment was mis-chosen [[hackaday-end-of-ondsel]]. Both are dated 2024-11. Kept as a
first-class conflict rather than averaged.

There is also a strong **confound** running through all of it: Ondsel required adopting a
new CAD system; AllSpice required adopting nothing. That difference alone might explain both
outcomes, independent of segment or format. If true, the operative lesson is not "pick
enterprises" but **"never require a CAD tool switch"** — which is a much sharper and more
actionable conclusion, and is currently the most plausible reading. See
[[ecad-mcad-versioning-asymmetry]].

## What would settle this

1. Verify the confound: did Ondsel Lens accept files from CAD systems other than FreeCAD?
   (`https://freecad.github.io/lens-docs/`)
2. Find the price points: what do AllSpice, GrabCAD Workbench, and entry-level PLM actually
   charge per seat? That brackets the viable range.
3. Talk to five people in different segments — a hobbyist, a two-person hardware startup, a
   mid-market manufacturer's engineering lead, a contract manufacturer, an enterprise PLM
   admin. Ask what they pay for today and what they email.
4. Check for AllSpice news 2024-2026 — a later round or a stall both mean something.

## History of the answer

| Date | Answer | What changed it |
|---|---|---|
| 2026-08-15 | Unresolved; inverted willingness-to-pay suspected; "never require a tool switch" is the leading lesson | Ondsel vs AllSpice contrast |

## Related

- [[ondsel]] — the negative case
- [[allspice]] — the positive case
- [[pdm-and-plm]] — who already holds the budget
- [[remix-graphs-vs-version-control]] — the segment with volume but no money
