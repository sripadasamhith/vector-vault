# Conversation — "is CAD sharing broken because of cloud lock-in?"

**Filed:** 2026-08-15
**Kind:** conversation (Sam + agent). Not a document; filed as a source per `raw/README.md`
("If it changed what you know, it's a source.").
**Fidelity:** written up from the exchange the same day. Paraphrased, not a transcript.

---

## The prompt

Sam relayed a claim from a friend: **because design tool providers force cloud-based usage,
it is hard to share design files between companies, between people, and between versions.**
He asked (a) whether GitHub equivalents exist for `.stl` design files and (b) whether the
problem as stated is real.

## What was found (details live in the fetched sources filed alongside this one)

- GitHub itself renders `.stl` under 10 MB with no diff capability.
- Third-party visual diff tools for 3D geometry exist only as hobby projects, e.g.
  `bdlucas1/diff3d` (STL/OBJ/3MF/STEP) and `scottlawsonbc/stldiff`. Not verified in depth;
  found via search result titles only.
- Real commercial traction in this space is in **electronics**, not mechanical CAD:
  AllSpice and CADLAB.io.
- Onshape ships genuine branch/merge for mechanical CAD, but only inside Onshape.
- Consumer STL repositories (Printables, MakerWorld, Thangs) offer remix/attribution
  graphs, not version control.
- Ondsel, a VC-backed attempt at exactly this, shut down in late 2024.

## The position taken in the conversation

The friend's observation is correct about the symptom and wrong about the cause.

1. Cloud-only delivery is real (Onshape is cloud-native by design; Fusion is
   cloud-attached; Dassault has pushed users toward 3DEXPERIENCE) and it does make
   cross-company collaboration require matching seats. But it is an **accelerant, not the
   root cause**.
2. The root cause is that CAD files are **compiled artifacts, not source**. STL especially:
   triangle soup, no parametrics, no assembly structure, no design intent. Sharing an STL
   is like shipping a stripped binary and calling it open source.
3. Therefore even a fully local-first CAD world would still have no diff, no merge, and no
   shared semantic layer.
4. Cross-company sharing is often *deliberately* gated (IP, NDA, ITAR), which a public-repo
   model does not map onto cleanly.
5. Willingness-to-pay is inverted: the people who feel the pain most (makers, small shops,
   cross-org collaborators) can pay least; enterprises who can pay already bought PLM.

## Caveats stated at the time

- The claims about Fusion's cloud-attachment and Dassault's 3DEXPERIENCE push were made
  from background knowledge and were **not** verified against a fetched source in this
  session.
- The ITAR / NDA / IP point is reasoning, not a sourced finding.
