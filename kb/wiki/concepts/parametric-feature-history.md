---
type: concept
title: Parametric Feature History
created: 2026-08-15
updated: 2026-08-15
tags: [design-intent, parametric, feature-tree, diffing]
status: active
confidence: medium
sources: ["[[capvidia-step-application-protocols]]", "[[hackaday-end-of-ondsel]]"]
---

# Parametric Feature History

> The ordered tree of sketches, constraints, and operations that produced a model — the
> closest thing CAD has to source code, and the thing no interchange format carries.

## The idea

A modern MCAD part is authored as a program: sketch a profile, constrain it, extrude, fillet
the result, pattern the fillet, and so on. The feature tree is that program; the solid is
its output. Editing a parameter re-executes the tree.

This is where design intent lives. "Make this wall 2 mm thick" is a tree edit; the same
change expressed on a mesh is thousands of moved vertices with no recoverable meaning.

Neutral formats do not carry it. STEP export "represents standardized data subsets rather
than complete native feature histories or parametric design intent"
[[capvidia-step-application-protocols]]. AP214 lists "construction history in 3D" among its
additions, but that is geometric construction data, not the authoring feature tree —
a distinction worth verifying rather than assuming.

## Why it matters here

If a diff could be computed over feature trees rather than geometry, most of what makes
version control valuable in software would transfer directly: semantic diffs, meaningful
merges, blame at the level of "who added this fillet." That is the prize.

Two hard obstacles stand in the way:

1. **Access.** The tree exists only inside proprietary formats. The exceptions are
   [[freecad]] and, server-side, [[onshape]].
2. **Stability.** Feature trees reference topology by name (`Face7`, `Edge12`), and those
   names are not stable across edits. This is the *topological naming problem*, and it is
   almost certainly what users mean when they report FreeCAD "models breaking after minor
   adjustments" [[hackaday-end-of-ondsel]]. A diff over unstable identifiers is a diff over
   noise.

## Mechanism / how it works

Consider two revisions where a designer inserted a chamfer between features 3 and 4. A
geometric diff sees a changed surface everywhere downstream. A tree diff sees one inserted
node. The tree diff is smaller, correct, and reviewable — but only if the identifiers on
either side of the insertion still refer to the same faces, which is exactly what
topological naming does not guarantee.

## Evidence

| Claim | Support | Against | Confidence |
|---|---|---|---|
| STEP drops native feature history | [[capvidia-step-application-protocols]] | — | high |
| Feature trees are where design intent lives | definitional | — | high |
| Topological naming makes tree identifiers unstable | [[hackaday-end-of-ondsel]] (indirect — symptom only) | — | medium — no source names the mechanism yet |
| AP214 "construction history" is not the authoring tree | inference from the feature list | — | low — **needs verification** |

## Instances

- [[freecad]] — the one open substrate with an inspectable tree
- [[onshape]] — has the tree server-side; does not export it

## Limits and failure modes

- **Mesh-only workflows have no tree at all.** For scanned, sculpted, or generatively
  designed geometry this concept simply does not apply, and geometric comparison is the only
  option — see [[geometry-diffing]].
- **A tree diff can be correct and useless.** Two trees producing identical geometry by
  different routes will diff loudly; two trees differing in one parameter may change
  everything downstream. Tree-level and geometry-level comparison answer different questions
  and a serious tool probably needs both.

## Contradictions

None recorded.

## Related

- [[cad-files-as-compiled-artifacts]] — the tree is the "source" the artifact was compiled from
- [[geometry-diffing]] — the fallback when no tree is available
- [[neutral-exchange-formats]] — the layer that drops the tree
- [[what-is-the-right-primary-artifact]] — the choice this concept informs
