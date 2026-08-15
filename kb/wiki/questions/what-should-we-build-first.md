---
type: question
title: What Should We Build First?
created: 2026-08-15
updated: 2026-08-15
tags: [product-design, sequencing, core-decision, validation]
status: active
confidence: low
sources: ["[[cad-files-as-compiled-artifacts]]", "[[geometry-diffing]]", "[[what-is-the-right-primary-artifact]]", "[[who-pays-for-cad-collaboration]]", "[[what-prior-art-exists-for-github-for-cad]]", "[[ecad-mcad-versioning-asymmetry]]"]
---

# What Should We Build First?

> Given the thesis and the landscape, what is the smallest piece of work that most reduces
> risk — and in what order should the cheap checks run before any code is written?

## Why it matters

The wiki now has a defensible picture of the problem but no sequencing. Every other page
answers "what is true"; this one answers "what do we do on Monday." It exists to prevent
the default failure mode of this category, which is building the technically interesting
thing before checking whether anyone wants it — the mode that killed [[ondsel]].

It also collects the four separate `What would settle this` sections scattered across the
open questions into one ordered list, so they can be worked rather than rediscovered.

## Current answer

**Confidence: low on the ranking, medium on the individual items.** The items below are
each well-grounded in a specific page; the *order* is a judgment call made once and not
yet tested.

The synthesis in one line: **the technical risk is smaller than the commercial risk, so
the cheap checks that could invalidate the whole premise should run before the build.**

### The strategic conclusion this rests on

[[ondsel]] required adopting a new CAD system. [[allspice]] required adopting nothing.
That single difference may explain both outcomes independent of format structure or market
segment [[who-pays-for-cad-collaboration]]. If it holds, the operative constraint is not
"pick the right segment" but **never require a CAD tool switch** — which is sharper,
more actionable, and currently the least examined claim in the wiki.

The product hypothesis that follows, carried over from
[[what-is-the-right-primary-artifact]] and still explicitly a hypothesis: accept files at
whatever fidelity users already have, store the original immutably, and make a **derived
representation** the primary versioned artifact. It degrades gracefully — STL gets a
geometric diff, STEP a solid-level one — and demands nothing of anyone's toolchain.

### The ordered list

1. **Read `bdlucas1/diff3d`.** Claims STL, OBJ, 3MF *and* STEP. The most directly relevant
   technical prior art in the entire survey, and one repository away. May answer the
   feasibility question in item 2 without writing any code
   [[what-prior-art-exists-for-github-for-cad]].
2. **Run the one-afternoon experiment.** Two revisions of one real part as STL, signed
   distance field, colour-mapped onto the surface. The success criterion is *not* "does it
   compute" — it is **is the output legible to someone who did not make the change**. Of
   the five approaches ranked in [[geometry-diffing]], mesh distance fields are the highest
   value-per-unit-effort and operate on the files people actually have.
3. **Talk to five people across segments** — a hobbyist, a two-person hardware startup, a
   mid-market engineering lead, a contract manufacturer, an enterprise PLM admin. Ask what
   they pay for today and what they email. Every demand-side claim in this wiki is
   currently inference [[who-pays-for-cad-collaboration]].
4. **Verify the Ondsel confound.** Did Ondsel Lens accept files from CAD systems other than
   FreeCAD? (`https://freecad.github.io/lens-docs/`) A cheap check that either confirms or
   demolishes the strategic conclusion above.
5. **Survey GrabCAD Workbench.** The closest historical attempt at exactly this pitch, at
   scale, inside Stratasys. Why it stalled is probably the highest-information unknown in
   the competitive picture [[what-prior-art-exists-for-github-for-cad]].

Items 1 and 4 are reading, item 2 is an afternoon, item 3 is the slowest and the one most
likely to change the product. Items 3 and 4 do not block on 1 and 2 and should run in
parallel.

## Evidence for

- Storage and preview are commodity; diff is the only defensible capability —
  [[geometry-diffing]]
- Requiring a tool switch appears fatal, and requiring none appears survivable —
  [[who-pays-for-cad-collaboration]], [[ecad-mcad-versioning-asymmetry]]
- Render-then-diff is proven in production, in 2D — [[allspice-git-for-hardware-pros-cons]]
- The cross-platform mechanical cell is empty and has a corpse in it —
  [[what-prior-art-exists-for-github-for-cad]]

## Evidence against

- **No evidence the render-then-diff pattern transfers to 3D solids**, where there is no
  canonical viewpoint. This is the single biggest technical unknown and item 2 exists to
  attack it directly — [[geometry-diffing]], [[ecad-mcad-versioning-asymmetry]].
- **The ordering privileges technical validation over commercial validation** by putting
  two reading tasks and an experiment ahead of user contact. Given that segment choice is
  what killed the closest precedent, a defensible alternative ranking puts item 3 first.
  Recorded here as a live objection rather than resolved.
- The strategic conclusion rests on a **two-data-point comparison** containing an
  unresolved contradiction — [[who-pays-for-cad-collaboration]].

## Known traps

Carried forward from [[geometry-diffing]] so they are not rediscovered during item 2:

- **Registration.** A part translated 10 mm with no shape change must diff as "moved," not
  "entirely different." Any approach needs an alignment step.
- **Tessellation noise.** Re-exporting an unchanged part at a different chord tolerance
  produces a completely different STL. If diffs are not robust to re-tessellation, every
  export reads as a change.
- **A visual diff is not a merge.** [[allspice]] solved review, not concurrent editing.
  Conflating the two will oversell the product.

## What would settle this

This page is answered by *doing* items 1-5 and recording what each returned. Specifically,
it should be revised when:

- item 2 produces an image a third party can or cannot read — the sharpest single result
- item 3 returns any contact with a real user, which would replace inference with evidence
  across [[who-pays-for-cad-collaboration]] and this page
- item 4 resolves the confound either way

If item 2 succeeds and item 3 finds a buyer, the derived-representation hypothesis in
[[what-is-the-right-primary-artifact]] should be promoted to a decision page.

## History of the answer

| Date | Answer | What changed it |
|---|---|---|
| 2026-08-15 | Five ordered items; read-before-build, with commercial validation running in parallel | Synthesized from the first ingest pass in response to a query |

## Related

- [[what-is-the-right-primary-artifact]] — the decision item 2 is designed to inform
- [[geometry-diffing]] — the technical crux and the source of the ranked approaches
- [[who-pays-for-cad-collaboration]] — the risk this sequencing is built around
- [[what-prior-art-exists-for-github-for-cad]] — where items 1 and 5 come from
- [[cad-files-as-compiled-artifacts]] — the thesis that makes diff the product
- [[overview]] — the synthesis this page operationalizes
