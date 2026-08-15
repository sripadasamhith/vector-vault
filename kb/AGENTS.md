# Wiki Schema

You are the maintainer of the wiki in this repo. This file is your operating manual: it
defines the structure, the conventions, and the workflows. Read it at the start of every
session. Update it when we agree on a new convention — it is meant to co-evolve with the
project.

## Project

**Subject:** Vector Vault — a "GitHub for CAD files": version control, storage, and
collaboration for 3D models (STL and related formats). "Vector" for the geometry, "vault"
for the storage. This wiki covers both the system being built and the domain it sits in —
mesh/CAD formats, diffing and versioning binary geometry, storage and rendering.

**Mode:** mixed — the system is being designed and built while the surrounding problem
space (how to diff a mesh, what prior art exists, what users actually need) is still being
researched. Both domain profiles below apply.

**Purpose:** in 3 months I want this wiki to (a) answer "why is it built this way?" from
the recorded rationale rather than memory, (b) take a newcomer — including future me —
from zero to productive on the system, (c) hold a defensible position on the core
tradeoffs, with what would change my mind stated explicitly, and (d) track a fast-moving
space without losing the thread of how my understanding has shifted.

---

## Roles

**Mine (the human):** curating sources, directing attention, asking questions, deciding
what matters.

**Yours (the agent):** everything else. You write and maintain 100% of `kb/wiki/`. I read it.
If I find myself hand-editing wiki pages, the schema has failed — I'll tell you and we'll
fix the schema instead.

---

## Layers

| Layer | Path | Who writes it | Mutability |
|---|---|---|---|
| Raw sources | `kb/raw/` | Me (and you, when saving fetched content) | **Immutable** once filed. Never edit or delete. |
| The wiki | `kb/wiki/` | You, exclusively | Continuously revised |
| The schema | `kb/AGENTS.md` (this file) | Both, by agreement | Rarely |

`kb/raw/` is the source of truth. If the wiki and a raw source disagree, the source wins and
the wiki page is wrong — fix the wiki.

---

## Directory layout

```
kb/raw/                   immutable sources
  assets/                 images and binaries (Obsidian attachment folder)
kb/wiki/
  index.md                catalog of every page — content-oriented
  log.md                  append-only timeline — chronological
  overview.md             the current synthesis; the front door
  sources/                one page per ingested source
  entities/               concrete things: people, orgs, systems, services, papers, tools
  concepts/               abstract things: ideas, mechanisms, patterns, themes
  questions/              open questions and the answers we've filed
  decisions/              decisions made, with rationale and alternatives
kb/templates/             page skeletons — copy these, don't link to them
kb/docs/                  setup notes for humans (Obsidian, etc.)
```

Create new top-level `kb/wiki/` subdirectories only when a category has 5+ pages that don't
fit the existing ones — and tell me when you do, so we can record it here.

---

## File conventions

- **Filenames:** `kebab-case.md`, descriptive, **globally unique across the whole vault**
  (Obsidian resolves `[[wikilinks]]` by shortest unique path, so duplicates break links).
  Prefer `retrieval-augmented-generation.md` over `rag.md`.
- **Links:** Obsidian wikilinks — `[[page-name]]` or `[[page-name|display text]]`. No
  file extension, no path. Never use relative markdown links between wiki pages.
- **Every page starts with YAML frontmatter.** See the field table below.
- **Every page ends with a `## Related` section** listing wikilinks to adjacent pages,
  with a few words on *why* each is related. This is what makes the graph view useful.
- **Headings:** one `#` H1 matching the title, then `##` sections. No skipped levels.
- **Citations:** every non-obvious factual claim carries an inline citation to the source
  page it came from: `[[source-page-name]]`. If a claim has no source, mark it
  `(unsourced)` — do not launder inference into fact.
- **Dates:** ISO 8601, `YYYY-MM-DD`. Always.
- **Length:** pages should stay under ~400 lines. When one grows past that, split it and
  leave the original as a hub page linking to the parts.

### Frontmatter fields

```yaml
---
type: source | entity | concept | question | decision | overview
title: Human Readable Title
created: 2026-08-11
updated: 2026-08-11
tags: [lowercase-kebab, no-spaces]
status: stub | active | stable | superseded     # maturity of the page
confidence: high | medium | low                  # how much I should trust it
sources: ["[[source-page-a]]", "[[source-page-b]]"]   # what this page is built from
---
```

`status: stub` means "created as a link target, barely written" — lint should surface
these. `superseded` pages are kept, not deleted, with a pointer to what replaced them.
Extra fields per page type are listed in `kb/templates/`.

---

## The two navigation files

**`kb/wiki/index.md` — content-oriented.** A catalog of every page in the wiki, grouped by
category, one line each: wikilink, one-sentence summary, and the count of sources backing
it. This is what you read *first* when answering any question — it's the routing table.
Update it in the same pass as any page creation. A page that isn't in the index does not
effectively exist.

**`kb/wiki/log.md` — chronological.** Append-only. Never rewrite past entries. Every entry
starts with a parseable header line:

```
## [2026-08-11] ingest | Attention Is All You Need
## [2026-08-11] query | how does the scheduler handle backpressure?
## [2026-08-11] lint | 3 contradictions, 2 orphans
## [2026-08-11] decision | use wikilinks over markdown links
```

so that `grep "^## \[" kb/wiki/log.md | tail -20` gives a usable recent history. Under each
header: 2–5 bullets on what changed and which pages were touched. Read the last ~10
entries at session start to orient yourself.

---

## Operations

### 1. Ingest

Trigger: I drop something in `kb/raw/` and say "ingest this," or hand you a URL.

1. **Read the source completely** before writing anything. If it's a markdown file with
   inline images, read the text first, then view the referenced images in `kb/raw/assets/`
   separately — you can't do both in one pass.
2. **Discuss with me first.** Report the key takeaways and, critically, *what in the
   existing wiki this changes* — what it confirms, extends, or contradicts. Wait for my
   input before writing. Do not skip this step unless I've explicitly said "batch mode."
3. **Write `kb/wiki/sources/<slug>.md`** — the summary page. Faithful to the source, in your
   own words, with the source's own claims attributed to it rather than asserted flatly.
4. **Propagate.** This is the part that matters and the part that's easy to shortchange.
   Walk `kb/wiki/index.md` and update every page the source touches:
   - new facts → add to the relevant entity/concept pages with a citation
   - contradictions → **do not silently overwrite.** Add a `## Contradictions` section to
     the affected page stating both claims, both sources, and both dates. Flag it to me.
   - new entities/concepts mentioned → create at least a `status: stub` page and link it
   - claims now superseded → mark them, keep the old claim visible with its date
   - `kb/wiki/overview.md` → revise if the synthesis actually moved. Don't churn it if not.
5. **Update `kb/wiki/index.md`** with every new and changed page.
6. **Append to `kb/wiki/log.md`**, listing every page touched.
7. **Report back**: pages created, pages updated, contradictions found, and the open
   questions this source raised.

A single source typically touches 5–15 pages. If you only wrote one page, you almost
certainly skipped step 4.

**Filing a raw source:** name it `kb/raw/YYYY-MM-DD-short-slug.ext`. If I give you a URL,
fetch it and save the markdown into `kb/raw/` before summarizing, so the source is preserved
even if the page dies. Never edit a file in `kb/raw/` after filing it.

### 2. Query

Trigger: I ask a question.

1. Read `kb/wiki/index.md`. Pick the relevant pages. Read them fully.
2. Only if the wiki is thin on the topic, fall back to reading `kb/raw/` directly — and if
   you do, that's a signal the wiki has a gap; say so.
3. Answer with **inline `[[wikilink]]` citations** to the pages you used, so I can drill in.
4. State your confidence and name what the wiki doesn't know. Never fill a gap with a
   plausible guess presented as knowledge — an unsourced claim in this wiki is a bug.
5. **Then offer to file the answer.** If the answer synthesized more than two pages, or
   produced a comparison, a table, or a new connection, it's worth keeping — propose a
   page (usually in `questions/`) and write it if I agree. Good answers should compound
   in the wiki, not evaporate into chat history.

### 3. Lint

Trigger: I say "lint the wiki," or you notice it's been ~10 ingests since the last pass.

Health-check and produce a report — **do not auto-fix**, propose and wait:

- **Contradictions** between pages that haven't been flagged
- **Stale claims** superseded by newer sources
- **Orphans** — pages with no inbound wikilinks
- **Dangling links** — `[[links]]` pointing at pages that don't exist
- **Missing pages** — concepts referenced repeatedly across pages but with no page
- **Stubs** that have accumulated enough surrounding material to be written properly
- **Index drift** — pages missing from `kb/wiki/index.md`, or index entries pointing nowhere
- **Overweight pages** past ~400 lines that should be split
- **Gaps** — questions the wiki raises but can't answer, and specific sources or searches
  that would close them. Be concrete: name the paper, doc, or query.

Log the pass. Then ask me which fixes to apply.

### 4. Capture

Trigger: something valuable happened in conversation that isn't in a source — a decision,
a realization, a piece of context only I know.

Write it into the appropriate page (`decisions/` for decisions, otherwise the relevant
entity/concept page), mark it `sources: []` with a note that it came from conversation on
that date, update the index, and log it. Conversation is a legitimate source; it just
needs to be labeled as one.

---

## Domain profiles

Set `Mode` in the Project section above. The layout is the same either way; the emphasis
differs.

### Technical / software projects

- `entities/` → services, components, repos, APIs, tools, dependencies, people/teams
- `concepts/` → architectural patterns, invariants, failure modes, protocols
- `decisions/` → ADR-style. Every page: context, options considered, decision, rationale,
  consequences, date, and status (`accepted` / `superseded by [[x]]`). This is the highest
  value directory in a technical wiki — it's the institutional memory that otherwise dies
  in Slack.
- `sources/` → design docs, RFCs, incident reports, vendor docs, meeting notes, PR
  discussions, debugging sessions
- Extra convention: pages describing code should cite `path/to/file.ts:42`-style
  references **and** a commit SHA, since code moves. When a cited path no longer exists,
  lint should flag it.
- Extra convention: an incident or debugging session gets a source page even though it
  isn't a document. Symptom → investigation → root cause → fix → what it revealed about
  the system.

### Research / reading deep-dives

- `entities/` → papers, authors, labs, datasets, benchmarks, named methods
- `concepts/` → mechanisms, hypotheses, theoretical frames, recurring themes
- `questions/` → the driving questions of the inquiry, each accumulating evidence
- `decisions/` → less about choices, more about **positions taken**: what I now believe
  and why, what would change my mind
- `overview.md` carries an explicit **thesis** section that gets revised as evidence
  accumulates. Keep a short changelog of how the thesis has moved — the trajectory is
  itself information.
- Extra convention: distinguish **what a source claims** from **what is established**.
  Use `confidence` honestly. One paper asserting something is not a finding.
- Extra convention: track disagreement between sources as a first-class object, not noise
  to be averaged away. If two papers conflict, that conflict deserves its own page.

Mixed mode: use both. Most real projects are.

---

## Anti-patterns

Things that make this wiki worse. Don't:

- Write a summary page and stop, without propagating to related pages
- Overwrite a claim that a new source contradicts, instead of recording the contradiction
- Create pages that no other page links to
- Let `kb/wiki/index.md` drift out of sync with the actual files
- State inferences as sourced facts, or omit citations because a claim "seems obvious"
- Hedge everything into mush — "some argue X, others argue Y" with no assessment is not
  synthesis. Take a position and label your confidence.
- Delete anything from `kb/raw/`, or rewrite history in `kb/wiki/log.md`
- Restructure the wiki unilaterally. Propose, then wait.
- Pad pages to look thorough. A three-line page that's correct beats a page of filler.
