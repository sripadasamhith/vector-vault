---
type: question
title: What Prior Art Exists for "GitHub for CAD"?
created: 2026-08-15
updated: 2026-08-15
tags: [prior-art, competitive-landscape, survey]
status: active
confidence: medium
sources: ["[[github-3d-file-viewer-docs]]", "[[onshape-git-style-version-control]]", "[[allspice-git-for-hardware-pros-cons]]", "[[techcrunch-allspice-series-a]]", "[[ondsel-shutdown-announcement]]", "[[conversation-cad-sharing-problem]]"]
---

# What Prior Art Exists for "GitHub for CAD"?

> Who has built version control and collaboration for 3D design files, how far did each get,
> and what does the pattern of what shipped versus what died tell us?

## Why it matters

Everything in this space has been attempted. Knowing which attempts died, which survived,
and on what axis they differed is the cheapest available substitute for making the same
mistakes.

## Current answer

Five distinct tiers, none of which is "GitHub for CAD" in full. Confidence: medium — the
survey is one session deep and several entries are unverified.

**1. Git itself, plus LFS.** Works as storage. No diff, no merge, no comprehension. GitHub
renders STL under 10 MB and offers no comparison at all
[[github-3d-file-viewer-docs]]. See [[git-lfs]].

**2. Hobby diff tools.** `bdlucas1/diff3d` (STL/OBJ/3MF/STEP) and `scottlawsonbc/stldiff`
exist on GitHub [[conversation-cad-sharing-problem]]. Found by search title only, **not
evaluated**. That the only general 3D diff tools are weekend projects is itself the finding.

**3. In-platform version control.** [[onshape]] ships real branching, merging, and branch
comparison [[onshape-git-style-version-control]] — inside its own cloud only. The capability
exists; the portability does not.

**4. ECAD collaboration platforms.** [[allspice]] ($6M + $3.2M seed, reported 10x growth
[[techcrunch-allspice-series-a]]) and [[cadlab-io]]. Genuine Git plus automatic visual
diffs, commercially alive. Electronics only — see [[ecad-mcad-versioning-asymmetry]].

**5. Open mechanical collaboration.** [[ondsel]]'s Lens: model sharing with privacy
controls and online parametric editing. Shut down 2024 [[ondsel-shutdown-announcement]].

**6. Consumer remix platforms.** Printables, MakerWorld, Thangs — attribution lineage, not
version control. See [[remix-graphs-vs-version-control]].

The pattern: **what shipped is either in-platform (Onshape) or in electronics (AllSpice).
What died is cross-platform mechanical (Ondsel).** That is precisely the cell Vector Vault
is aiming at, and the wiki should be honest that it is the empty one for a reason.

## Evidence for

- GitHub's viewer is render-only with a 10 MB ceiling — [[github-3d-file-viewer-docs]]
- Onshape's version control is real and platform-bound — [[onshape-git-style-version-control]]
- AllSpice raised and grew in ECAD — [[techcrunch-allspice-series-a]]
- Ondsel died in MCAD — [[ondsel-shutdown-announcement]]

## Evidence against / gaps

- **Not surveyed:** GrabCAD Workbench, Autodesk Upchain, Duro, Wikifactory, Valispace,
  Fictiv, KiCad-adjacent tooling, Ganister. Several of these are direct prior art and their
  absence makes this survey provisional.
- **Not surveyed:** the PDM/PLM incumbents at all — see [[pdm-and-plm]].
- Hobby diff tools listed but never opened.

## What would settle this

1. Read `bdlucas1/diff3d` — it claims STL, OBJ, 3MF *and* STEP. Its approach is the most
   directly relevant technical prior art in the whole survey and it is one repository away.
2. Survey GrabCAD Workbench specifically: it is the closest historical attempt at exactly
   this pitch, at scale, inside Stratasys. Why did it stall?
3. Check whether AllSpice has moved into MCAD since 2023. If it has, that changes the
   competitive picture entirely.

## History of the answer

| Date | Answer | What changed it |
|---|---|---|
| 2026-08-15 | Six tiers; the cross-platform mechanical cell is empty and has a corpse in it | First survey pass |

## Related

- [[ecad-mcad-versioning-asymmetry]] — the explanation for the pattern
- [[geometry-diffing]] — the capability that separates the tiers
- [[who-pays-for-cad-collaboration]] — why the empty cell is empty
- [[what-should-we-build-first]] — reading `diff3d` and surveying GrabCAD, promoted to actions
