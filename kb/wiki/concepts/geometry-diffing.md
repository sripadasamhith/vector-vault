---
type: concept
title: Geometry Diffing
created: 2026-08-15
updated: 2026-08-15
tags: [diffing, mesh, brep, review, core-problem]
status: active
confidence: medium
sources: ["[[allspice-git-for-hardware-pros-cons]]", "[[github-3d-file-viewer-docs]]", "[[onshape-git-style-version-control]]"]
---

# Geometry Diffing

> Computing and presenting what changed between two revisions of a 3D model — the missing
> capability that everything else in this space works around, and the core technical problem
> for Vector Vault.

## The idea

Version control without diff is just backup. For text, diff is a solved line-alignment
problem. For geometry there is no canonical unit to align: no lines, no stable ordering, and
in a mesh not even stable vertex identity between exports of the same unchanged part.

The state of the art divides cleanly:

- **Nobody shipped a general one.** GitHub renders STL but offers no comparison
  [[github-3d-file-viewer-docs]]. Standalone tools exist only as hobby projects
  (`bdlucas1/diff3d`, `scottlawsonbc/stldiff`) [[conversation-cad-sharing-problem]].
- **In-platform diff works** when one vendor controls the kernel and document model:
  [[onshape]] claims to visualize branch differences "just like GitHub does for software
  code" [[onshape-git-style-version-control]].
- **Render-then-diff works** in electronics: [[allspice]] parses native ECAD formats,
  renders to SVG, and highlights deletions in red, changes in yellow, additions in green
  [[allspice-git-for-hardware-pros-cons]].

## Why it matters here

This is the product. Storage is commodity, hosting is commodity, and previewing is a
weekend of three.js. If Vector Vault has an answer to "show me what changed and let a
non-CAD-user understand it," it has something; if not, it is [[git-lfs]] with a nicer
homepage.

The AllSpice pattern is the most transferable: **do not diff the file, diff a deterministic
rendering of the file.** It sidesteps the impossibility of merging interwoven binaries and
produces output legible to reviewers without a CAD license — which
[[allspice-git-for-hardware-pros-cons]] identifies as a major unlock in its own right.

## Mechanism / how it works

Candidate approaches, roughly in increasing order of ambition:

1. **Image diff.** Render both revisions from fixed viewpoints, compare pixels. Trivial to
   build, catches gross changes, produces false positives from any camera or lighting drift,
   and says nothing about magnitude. AllSpice's 2D analogue works well because a PCB has a
   canonical top-down projection; a 3D solid does not.
2. **Bounding box / mass properties.** Compare volume, surface area, centre of mass,
   bounding box. Cheap, quantitative, order-independent, and genuinely useful as a
   change *signal*. Useless for localization.
3. **Mesh distance fields.** Sample signed distance from mesh A to mesh B, colour-map the
   deviation onto the surface. This is the established metrology approach and it localizes
   changes properly. Costly on large meshes; sensitive to registration when parts move.
4. **BREP topological comparison.** Match faces and edges between two solids and report
   added/removed/modified. Semantically the right answer at the solid level. Hard, and
   dependent on the same identifier-stability problem as
   [[parametric-feature-history]].
5. **Feature tree diff.** The prize; blocked on access and topological naming. See
   [[parametric-feature-history]].

Approach 3 is the highest value-per-unit-effort starting point and works on STL, which is
what people actually have.

## Evidence

| Claim | Support | Against | Confidence |
|---|---|---|---|
| No general-purpose 3D diff exists as a product | [[github-3d-file-viewer-docs]]; only hobby tools found | [[onshape-git-style-version-control]] (in-platform only) | medium-high |
| Render-then-diff is a viable production pattern | [[allspice-git-for-hardware-pros-cons]] | — | medium-high — proven in 2D ECAD, unproven for 3D solids |
| Reviewers without CAD licenses are a real, underserved audience | [[allspice-git-for-hardware-pros-cons]] | — | medium |
| Diff is solvable when you own the kernel | [[onshape-git-style-version-control]] | — | medium — vendor claim, no detail |

## Instances

- [[allspice]] — render-then-diff in production for ECAD
- [[onshape]] — in-platform branch comparison
- [[github-3d-file-viewer]] — render without diff

## Limits and failure modes

- **A visual diff is not a merge.** AllSpice solves review, not concurrent editing
  [[allspice-git-for-hardware-pros-cons]]. Conflating them will oversell the product.
- **Registration ruins naive comparison.** A part translated 10 mm with no shape change
  should diff as "moved," not "entirely different." Any approach needs an alignment step.
- **Tessellation noise.** Re-exporting an unchanged part at different chord tolerance
  produces a completely different STL. Diffs must be robust to re-tessellation or every
  export reads as a change.
- **No canonical viewpoint in 3D.** The single biggest reason the AllSpice approach does not
  transfer directly from PCBs.

## Contradictions

None between sources. Note the tension in scope: Onshape has diff but no portability;
AllSpice has portability but works on 2D-projectable artifacts.

## Related

- [[cad-files-as-compiled-artifacts]] — why this is hard at all
- [[parametric-feature-history]] — the semantic ceiling
- [[ecad-mcad-versioning-asymmetry]] — why electronics got here first
- [[what-is-the-right-primary-artifact]] — what to diff
- [[what-should-we-build-first]] — where approach 3 sits in the build order, and the traps it carries forward
