---
type: question
title: Is Cloud Lock-In the Root Cause of CAD Sharing Friction?
created: 2026-08-15
updated: 2026-08-15
tags: [thesis, lock-in, framing]
status: active
confidence: medium
sources: ["[[conversation-cad-sharing-problem]]", "[[ondsel-shutdown-announcement]]", "[[capvidia-step-application-protocols]]", "[[onshape-git-style-version-control]]"]
---

# Is Cloud Lock-In the Root Cause of CAD Sharing Friction?

> When engineers cannot easily share design files across companies, people, and versions, is
> the binding constraint (a) vendors forcing cloud-based, single-platform usage, or (b)
> something about the files themselves that would persist even with fully local, open tools?

## Why it matters

It determines what Vector Vault is. If (a), the product is portable hosting and open
storage — take the files out of the vendor's cloud and the problem eases. If (b), portable
hosting changes nothing on its own, and the product has to be a semantic layer over
geometry. These are different companies.

## Current answer

**(b), with (a) as a real accelerant.** Confidence: medium — the argument is strong, the
direct evidence is partly circumstantial.

Cloud lock-in is genuine. [[onshape]] ships the best version control in mechanical CAD and
it works only inside Onshape [[onshape-git-style-version-control]]; the effect is that
cross-company collaboration becomes a licensing question. But three things point past it as
the root cause:

1. **The formats were lossy before the cloud existed.** STEP export "represents standardized
   data subsets rather than complete native feature histories or parametric design intent"
   [[capvidia-step-application-protocols]], and that has been true since long before
   cloud CAD. Emailing `.sldprt` files in 2005 had the same diff and merge problems.
2. **Removing lock-in has been tried and did not unlock a market.** [[ondsel]] built on open
   FreeCAD with an open kernel and shut down after ~100 engineer interviews, having "failed
   to find commercial adoption" [[ondsel-shutdown-announcement]]. That is close to a natural
   experiment for the lock-in hypothesis, and it came out negative.
3. **The blocking capability is diff, not access.** Even given every file locally in an open
   format, there is still no way to see what changed between two revisions — see
   [[geometry-diffing]]. Access is necessary, not sufficient.

The correct causal ordering: files are compiled artifacts
([[cad-files-as-compiled-artifacts]]) → design intent lives only in proprietary
representations → vendors can therefore make collaboration a platform feature
([[cloud-lock-in-in-cad]]) → cross-company work degrades to emailing STEP and STL.

## Evidence for (b)

- Neutral formats lose feature history and design intent — [[capvidia-step-application-protocols]]
- Binary design formats defeat merge regardless of hosting; "This isn't a downside of Git,
  this is a downside of the ECAD file formats" — [[allspice-git-for-hardware-pros-cons]]
- An open-source, lock-in-free attempt failed commercially — [[ondsel-shutdown-announcement]]

## Evidence for (a)

- The best MCAD version control exists but is confined to one vendor's cloud —
  [[onshape-git-style-version-control]]
- Ondsel's failure is confounded: it required switching CAD systems entirely, so it is not a
  clean test of "remove lock-in, see if collaboration follows" — [[hackaday-end-of-ondsel]]
- Vendor movement toward cloud delivery is real (Fusion cloud-attached, Dassault pushing
  3DEXPERIENCE) — **(unsourced)**, asserted in [[conversation-cad-sharing-problem]] and not
  verified

## What would settle this

Concrete and cheap:

1. **Verify the Ondsel confound.** Did Lens support files from other CAD systems, or only
   FreeCAD? If only FreeCAD, its failure says little about lock-in and the evidence for (b)
   weakens. Check the Lens documentation at `https://freecad.github.io/lens-docs/`.
2. **Check Onshape's export surface.** If branch/merge history is exportable in any form,
   lock-in is weaker than assumed. If not, it is confirmed architecturally.
3. **Interview two people who actually hit this**: someone sending parts to an external
   supplier, and someone receiving them. Ask what they email, what goes wrong, and whether
   they would care if it were versioned. This is the fastest way to test whether "share
   across companies" is a felt problem or a plausible-sounding one.
4. **Read the Hacker News discussion** of the Ondsel shutdown
   (`news.ycombinator.com/item?id=42169998`) for practitioner diagnosis.

## History of the answer

| Date | Answer | What changed it |
|---|---|---|
| 2026-08-15 | (b) with (a) as accelerant; medium confidence | Initial framing from [[conversation-cad-sharing-problem]] plus the first seven sources |

## Related

- [[cad-files-as-compiled-artifacts]] — the thesis this question resolves toward
- [[cloud-lock-in-in-cad]] — the hypothesis under test
- [[who-pays-for-cad-collaboration]] — the commercial half of the same problem
