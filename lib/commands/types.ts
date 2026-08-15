// Type contracts for lib/commands/** per ARCHITECTURE.md §3. Commands never
// import Supabase or call fetch directly — they receive this context object
// and call lib/client-api.ts, which is what keeps the command set portable
// to a real CLI later (ARCHITECTURE.md §2).

import type { DiffResult } from '../domain/diff';

export interface CommandContext {
  repoId: string;
  owner: string;
  slug: string;
  branch: string;
  userId: string;
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
