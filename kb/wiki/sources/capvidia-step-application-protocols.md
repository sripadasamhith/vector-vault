---
type: source
title: Capvidia — STEP AP203 vs AP214 vs AP242
created: 2026-08-15
updated: 2026-08-15
tags: [step, file-formats, interoperability, pmi]
status: active
confidence: medium
sources: []
raw: raw/2026-08-15-capvidia-step-ap203-ap214-ap242.md
origin: https://www.capvidia.com/blog/best-step-file-to-use-ap203-vs-ap214-vs-ap242
author: Capvidia
published: null
kind: article
---

# Capvidia — STEP AP203 vs AP214 vs AP242

> What the neutral exchange format actually carries, and — more importantly for this
> project — what it does not.

## Summary

STEP is an ISO neutral 3D CAD format specified in EXPRESS and split into Application
Protocols. **AP203** covers configuration-controlled mechanical design: geometry (wireframe,
surface, faceted, BREP solids), topology, configuration management, change control, and
security classification; aerospace and defense lean on it. **AP214** targets automotive and
adds colors and layers, GD&T with graphical presentation, 3D construction history,
kinematics, tolerance data, and validation properties. **AP242** merges both and adds 3D
semantic PMI, shape quality, parametric and geometric constraints, kinematics assembly and
electrical harness, piping, DRM and long-term archiving, and mechatronics.

Capvidia's recommendation is unambiguous: "STEP AP 242 is the better format, because it
combines both AP 203 and AP 214." It notes ISO/TC 184/SC 4 has withdrawn from future work
on the older protocols — "AP203 and AP214 are withdrawn...They were deprecated with the
publication of AP242 in 2014" — while acknowledging both remain popular in practice.

Critically for this wiki, the article states native CAD formats are proprietary and "cannot
directly be translated nor converted to another proprietary CAD system," and that STEP
export "represents standardized data subsets rather than complete native feature histories
or parametric design intent."

## Key claims

| Claim | Evidence given | My confidence |
|---|---|---|
| AP242 supersedes AP203 and AP214, deprecated 2014 | Cites ISO/TC 184/SC 4 | high |
| AP242 carries semantic PMI and geometric constraints | Feature enumeration | medium-high — capability of the standard, not of any given exporter |
| STEP loses native feature history and design intent | Stated directly | high — this is the consensus and matches the mechanics |
| AP203/214 remain widely used despite deprecation | Assertion | medium — matches practice, no data given |

## What this changes in the wiki

- **Confirms:** [[cad-files-as-compiled-artifacts]] — the neutral format is a lossy
  handoff by construction.
- **Extends:** [[neutral-exchange-formats]] — gives the concrete capability ladder
  AP203 → AP214 → AP242.
- **Extends:** [[parametric-feature-history]] — names precisely what is lost.

## Notable details

Vendor caveat: Capvidia sells CAD translation and validation, so it has an interest in
portraying interoperability as difficult. The specific claims here are nonetheless
consistent with the ISO record and are safe to rely on; the *severity* framing is not.

A capability existing in AP242 is not the same as an exporter emitting it or an importer
reading it. Treat AP242 support as a spectrum, not a checkbox — unverified in this session.

## Questions raised

- What fraction of real-world AP242 files in the wild actually carry semantic PMI? If it is
  low, "AP242 solves interoperability" is a paper claim.
- Is there any neutral format that preserves the parametric feature tree? (Working answer:
  no widely-adopted one — this is the gap.)

## Related

- [[neutral-exchange-formats]] — the concept this grounds
- [[parametric-feature-history]] — what STEP drops
- [[cad-files-as-compiled-artifacts]] — the thesis
