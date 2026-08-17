// Type contracts for lib/commands/** per ARCHITECTURE.md §3. Commands never
// import Supabase or call fetch directly — they receive this context object
// and call lib/client-api.ts, which is what keeps the command set portable
// to a real CLI later (ARCHITECTURE.md §2).

import type { DiffResult } from '../domain/diff';

export interface CommandContext {
  repoId: string;
  owner: string;
  slug: string;
  /** A real branch name — the one write commands (add/rm/commit) target.
   * Always the repo's default branch when `detached` is true, since there
   * is no real branch to write to at a detached ref. */
  branch: string;
  userId: string;
  /** T4.1 — the ref actually checked out right now: equals `branch` when on
   * a branch, or a tag name / short sha when `detached` is true. */
  ref: string;
  /** T4.1 — true when `ref` does not name a real branch (checked out a tag
   * or a commit sha directly). Write commands must refuse in this state —
   * it's a read-only view, not a branch to commit onto. */
  detached: boolean;
  /** T4.1 — checkout's way of changing what's checked out. Implemented by
   * command-bar.tsx (a cookie, so the next server render picks it up); a
   * real CLI implementation would write a local config file instead — the
   * command itself never touches storage directly (ARCHITECTURE.md §2). */
  setRef: (ref: string) => void;
  /** Commands navigate by calling this, never by touching the router directly. */
  navigate: (href: string) => void;
  /** Mutates client cache after a write. */
  refresh: () => void;
}

export type CommandOutput =
  | { type: 'text'; lines: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'diff'; result: DiffResult }
  | { type: 'error'; message: string; hint?: string };

export interface CommandResult {
  output: CommandOutput;
  /** Set when the command changed server state, so the page can revalidate. */
  mutated?: boolean;
}

export interface Command {
  name: string;
  summary: string; // one line, shown by `help`
  usage: string; // 'commit -m "<message>"'
  run(args: string[], ctx: CommandContext): Promise<CommandResult>;
}
