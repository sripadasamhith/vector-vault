---
type: concept
title: Cloud Lock-In in CAD
created: 2026-08-15
updated: 2026-08-15
tags: [lock-in, business-model, cloud-cad]
status: active
confidence: medium
sources: ["[[onshape-git-style-version-control]]", "[[conversation-cad-sharing-problem]]"]
---

# Cloud Lock-In in CAD

> The pattern where design tools are delivered as cloud services whose collaboration
> features work only among users of the same service — making cross-organization
> collaboration a licensing question rather than a technical one.

## The idea

Three delivery models coexist: fully cloud-native ([[onshape]]), cloud-attached desktop
([[autodesk-fusion]]), and desktop with a cloud platform being pushed alongside
([[solidworks]] / 3DEXPERIENCE). The direction of travel is toward the cloud in all three.

The consequence for collaboration is specific: **version history and review live in the
platform's data model, not in the file.** Onshape can offer branching, difference
visualization, and protected merge workflows [[onshape-git-style-version-control]] precisely
because it owns the kernel, the document model, and the storage. Nothing about that survives
export. Two companies collaborating therefore need matching seats, or they fall back to
emailing STEP and STL — which is where [[cad-files-as-compiled-artifacts]] takes over.

## Why it matters here

This is the pain Vector Vault's premise responds to, and it is real. But it is important to
get the causal ordering right, or the product aims at the wrong thing. The position taken
in this wiki is that lock-in is an **accelerant, not the root cause** — see
[[is-cloud-lock-in-the-root-cause]] for the argument and the counter-evidence.

## Mechanism / how it works

Lock-in here is not primarily contractual. It is architectural:

1. Design intent exists only in the vendor's proprietary representation.
2. Collaboration features are computed over that representation server-side.
3. Export formats are defined by standards bodies to carry *geometry*, not *history*
   [[capvidia-step-application-protocols]].
4. So exporting loses the thing that made collaboration work, and there is no format to
   exchange it in even if a vendor wanted to.

Step 3 is the load-bearing one, and it is the step a standards effort — not a startup —
would have to change.

## Evidence

| Claim | Support | Against | Confidence |
|---|---|---|---|
| The best MCAD version control is cloud-only | [[onshape-git-style-version-control]] | — | high |
| Version history does not survive export | absence of any export claim in the source; format limits in [[capvidia-step-application-protocols]] | — | medium — argument from silence |
| Vendors are moving toward cloud delivery generally | [[conversation-cad-sharing-problem]] | — | low — **unsourced**, needs primary sources for Autodesk and Dassault |
| Removing lock-in is sufficient to unlock collaboration | — | [[ondsel-shutdown-announcement]] | low — the Ondsel outcome argues against |

## Instances

- [[onshape]] — cloud-native, best-in-class version control, zero portability
- [[autodesk-fusion]] — cloud-attached
- [[solidworks]] — desktop incumbent with a cloud platform alongside

## Limits and failure modes

- **Cloud is not the villain by itself.** Onshape's cloud model is what *enables* its
  version control. The problem is single-vendor scope, not remote execution.
- **The "forced" framing overstates it.** Desktop CAD with local files still exists. The
  friction is that the collaboration features are cloud-gated, not that the tools are.
- **Deliberate gating gets misread as lock-in.** Much cross-company restriction is IP, NDA,
  or export-control policy, not vendor capture. (**Unsourced** — reasoning only, flagged in
  [[conversation-cad-sharing-problem]].)

## Contradictions

None between sources yet. The claims about Autodesk and Dassault in this page are
explicitly unsourced and should be replaced with primary sources before being relied on.

## Related

- [[is-cloud-lock-in-the-root-cause]] — the open question this concept feeds
- [[cad-files-as-compiled-artifacts]] — the deeper cause
- [[pdm-and-plm]] — the incumbent, org-scoped answer
