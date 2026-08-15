# Obsidian setup

The working arrangement: **agent on one side of the screen, Obsidian on the other.** The
agent edits the wiki; you read it live in Obsidian, following links and watching the graph
fill in. Obsidian is the IDE, the agent is the programmer, the wiki is the codebase.

Obsidian is a local markdown reader over a folder — it adds no lock-in. The repo stays a
plain git repo of markdown files.

---

## 1. Open the repo as a vault

Obsidian → **Open folder as vault** → select this repo's root folder. That's the whole
install step. Every `.md` file in `raw/`, `wiki/`, `docs/`, and `templates/` becomes a
note; `[[wikilinks]]` between them become navigable.

This repo ships a `.obsidian/app.json` with the settings below already applied, so a fresh
clone opens correctly configured. Obsidian may need a restart to pick it up. If you'd
rather set them by hand, or want to check what's there:

| Setting | Value | Where | Why |
|---|---|---|---|
| Attachment folder path | `raw/assets` | Files and links | Clipped images land in `raw/`, not scattered |
| New link format | Shortest path | Files and links | Matches the `[[page-name]]` convention in `AGENTS.md` |
| Use `[[Wikilinks]]` | On | Files and links | The agent writes wikilinks, not markdown links |
| Automatically update internal links | On | Files and links | Renames don't break the graph |
| Default view for new tabs | Reading | Editor | You're reading, not writing |
| Excluded files | `templates/` | Files and links | Keeps skeleton pages out of search and graph |
| Default location for new notes | `wiki` | Files and links | If you do jot something, it lands somewhere sane |

`.obsidian/workspace.json` (pane layout, which files are open) is gitignored — it's
per-machine noise. Shared settings are committed.

---

## 2. Turn on the core plugins that matter

Settings → **Core plugins**. Enable:

- **Graph view** — the fastest way to see the shape of the wiki: what's a hub, what's an
  orphan, which clusters formed. Run a lint pass whenever it looks lopsided.
- **Backlinks** — shows what links *to* the page you're reading. This is how you audit
  whether the agent actually propagated an ingest.
- **Outgoing links** — surfaces unresolved links, i.e. pages the agent promised but never
  wrote.
- **Templates** — set the template folder to `templates/` if you ever want to stamp a page
  manually. Mostly the agent does this.
- **Search** — Obsidian's built-in search is enough at this scale. If the wiki outgrows it
  (many hundreds of pages), add a local search engine like
  [qmd](https://github.com/tobi/qmd) and teach the agent to shell out to it.

### Optional community plugins

Settings → Community plugins → Browse. (Requires turning off Restricted mode.)

- **Dataview** — runs queries over the YAML frontmatter every page in this wiki carries.
  Because `type`, `status`, `confidence`, and `updated` are standardized, you get live
  dashboards for free. Drop this in a note:

  ````markdown
  ```dataview
  TABLE status, confidence, updated
  FROM "wiki"
  WHERE status = "stub"
  SORT updated ASC
  ```
  ````

  That's a live list of every under-written page. Same trick for `confidence = "low"`
  (what to trust least) or `WHERE type = "question" AND status = "active"` (what's still
  open).
- **Marp** — markdown slide decks, if you want the agent to generate a presentation
  straight out of wiki content.

---

## 3. Web Clipper (getting sources in)

The [Obsidian Web Clipper](https://obsidian.md/clipper) browser extension converts a web
page to clean markdown and drops it into your vault. It's the fastest path from "I found
an article" to "it's in `raw/`."

Set the clipper's default save location to `raw/` so clips land in the source layer rather
than the wiki. Then tell the agent to ingest it.

**Get the images too.** The clipper leaves images as remote URLs, which saves space but
breaks offline and dies with link rot — and the agent can't view an image it can't open.
Fix: with the clipped note open, run the command **"Download attachments for current
file"** (Cmd/Ctrl-P, or bind a hotkey in Settings → Hotkeys). Every referenced image
downloads into `raw/assets/` and the links rewrite to local paths.

Note that agents can't read a markdown file's text and view its inline images in a single
pass — they read the text first, then open the images separately. Local files make that
possible at all.

---

## 4. Reading the wiki as it's built

Habits that make this arrangement work:

- **Watch the graph during an ingest.** New nodes appearing with no edges means the agent
  wrote pages but didn't cross-reference them — the most common failure. Push back.
- **Check backlinks on a page you care about** after an ingest. If nothing new points at
  it, the propagation step was skipped.
- **Use unresolved links (shown greyed out) as a to-do list.** They're the agent's own
  promises.
- **Read `wiki/log.md` bottom-up** to see what happened recently.
- Obsidian edits and agent edits can collide if you both write the same file at the same
  moment. In practice: let the agent write, you read. That's the arrangement anyway.

---

## 5. Git

The vault is a git repo, so you get version history and diffs for free — worth committing
after each ingest, which makes `git log` a second view of the wiki's evolution and lets
you diff exactly what one source changed:

```bash
git add -A && git commit -m "ingest: <source title>"
git show --stat HEAD          # which pages that source touched
```

If you want this automatic, the **Obsidian Git** community plugin commits on a timer.
