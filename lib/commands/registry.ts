// T1.7 — name -> Command map (ARCHITECTURE.md §1). The command set for
// Phase 1 (BUILD.md T1.7): help, whoami, clear, status, ls, log, add, rm,
// commit. Later phases (branch, checkout, tag, revert, merge, share, diff)
// register into the same map without touching this file's shape.
import type { Command } from './types';
import { makeHelp } from './impl/help';
import { whoami } from './impl/whoami';
import { clear } from './impl/clear';
import { status } from './impl/status';
import { ls } from './impl/ls';
import { log } from './impl/log';
import { add } from './impl/add';
import { rm } from './impl/rm';
import { commit } from './impl/commit';
import { diff } from './impl/diff';
import { branch } from './impl/branch';
import { checkout } from './impl/checkout';
import { tag } from './impl/tag';
import { revert } from './impl/revert';
import { merge } from './impl/merge';
import { share } from './impl/share';

const baseCommands: Command[] = [
  whoami,
  clear,
  status,
  ls,
  log,
  add,
  rm,
  commit,
  diff,
  branch,
  checkout,
  tag,
  revert,
  merge,
  share,
];

export const registry = new Map<string, Command>(baseCommands.map((c) => [c.name, c]));

// help needs to see the full registry, including itself — built last and
// added after the others so `help` can list every command (itself included)
// without a circular import between registry.ts and impl/help.ts.
const help = makeHelp(() => Array.from(registry.values()));
registry.set(help.name, help);

export function getCommand(name: string): Command | undefined {
  return registry.get(name);
}

export function listCommandNames(): string[] {
  return Array.from(registry.keys()).sort();
}
