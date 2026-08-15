---
type: source
title: Conversation — Is Cloud Lock-In the Root Cause?
created: 2026-08-15
updated: 2026-08-15
tags: [conversation, framing, thesis]
status: active
confidence: medium
sources: []
raw: raw/2026-08-15-conversation-cad-sharing-problem.md
origin: null
author: Sam Sripada + agent
published: 2026-08-15
kind: conversation
---

# Conversation — Is Cloud Lock-In the Root Cause?

> The conversation that produced this wiki's first thesis. Filed as a source because the
> synthesis in it is not in any of the fetched documents.

## Summary

Sam relayed a friend's claim: because design tool vendors force cloud-based usage, sharing
design files across companies, people, and versions is hard. He asked whether GitHub
equivalents exist for `.stl` and whether the problem is real.

The answer given: the friend is **right about the symptom and wrong about the cause**.
Cloud-only delivery is real and does force matching seats for collaboration, but it is an
accelerant. The root cause is that CAD files are compiled artifacts rather than source —
STL most extremely, being triangle soup with no parametrics, assembly structure, units
convention, or design intent. The analogy used: sharing an STL is like shipping a stripped
binary and calling it open source. It follows that a fully local-first CAD world would
*still* have no diff, no merge, and no shared semantic layer.

Two further points were made from reasoning rather than sources: cross-company sharing is
frequently gated deliberately (IP, NDA, ITAR), which a public-repo model does not fit; and
willingness to pay is inverted — the people who feel the pain most can pay least, while
enterprises that can pay have already bought PLM.

## Key claims

| Claim | Evidence given | My confidence |
|---|---|---|
| Cloud lock-in is an accelerant, not the root cause | Argument, plus Ondsel as a natural experiment | medium-high — see [[is-cloud-lock-in-the-root-cause]] |
| STL cannot support meaningful collaboration because it carries no design intent | Format mechanics | high |
| Cross-company sharing is often deliberately restricted | Reasoning only | low — **unsourced**, needs evidence |
| Willingness to pay is inverted across segments | Ondsel vs AllSpice outcomes | medium |

## What this changes in the wiki

- **Establishes:** [[cad-files-as-compiled-artifacts]] as the wiki's central thesis.
- **Establishes:** [[is-cloud-lock-in-the-root-cause]] as an open question with a stated
  position.
- **Frames:** [[overview]] — first real synthesis, replacing the template stub.

## Notable details

Explicit caveats recorded at the time: the claims about Autodesk Fusion being
cloud-attached and Dassault pushing users toward 3DEXPERIENCE were made from background
knowledge and **not verified against a fetched source** in this session. They are carried
in the wiki as `(unsourced)`.

## Questions raised

- [[what-is-the-right-primary-artifact]] — if STL is the wrong unit, what is the right one?
- Is there a defensible product in "make design changes legible to people without a CAD
  seat," independent of version control?

## Related

- [[cad-files-as-compiled-artifacts]] — the thesis this produced
- [[is-cloud-lock-in-the-root-cause]] — the question it framed
- [[overview]] — the synthesis it seeded
