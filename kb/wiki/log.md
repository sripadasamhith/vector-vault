---
type: overview
title: Log
created: 2026-08-15
updated: 2026-08-15
tags: [meta]
status: active
confidence: high
sources: []
---

# Log

Append-only. Newest entries at the bottom. Never rewrite a past entry.

Every entry header must match `## [YYYY-MM-DD] <op> | <subject>` where `<op>` is one of
`ingest`, `query`, `lint`, `decision`, `capture`, so that the log stays greppable:

```
grep "^## \[" kb/wiki/log.md | tail -20
```

---

## [2026-08-15] capture | wiki initialized for Vector Vault

- Installed the llm-wiki template into `kb/`. Paths in `kb/AGENTS.md` and `kb/CLAUDE.md`
  rewritten to be relative to the repo root.
- Project block filled in: subject Vector Vault ("GitHub for CAD"), mode mixed, purpose
  covering rationale recovery, onboarding, defensible tradeoffs, and tracking the space.
- Mixed mode — both domain profiles (technical and research) kept in `kb/AGENTS.md`.
- Seed pages reset for this project: `overview.md`, `index.md`, `log.md`.
- No sources ingested yet; `kb/raw/` is empty.
