# raw/

Source documents. **Immutable.** The agent reads from here and never edits or deletes
anything in this directory.

## Conventions

- Name files `YYYY-MM-DD-short-slug.ext` using the date you filed it.
- Images and other binaries go in `raw/assets/` — this is set as Obsidian's attachment
  folder, so clipped article images land here automatically.
- Anything fetched from a URL gets saved here as markdown before it's summarized, so the
  source survives link rot.
- Large binaries (video, big datasets) are gitignored by default. Keep a stub `.md` next
  to them noting what and where they are.

## What counts as a source

Documents, obviously — papers, articles, docs, RFCs, transcripts. But also things that
aren't documents: a debugging session, an incident, a conversation, a meeting. Write those
up as markdown and file them here. If it changed what you know, it's a source.
