'use client';

// T1.7/T1.8. Owns running commands (via lib/commands/run.ts, never fetch
// directly — ARCHITECTURE.md §2) and the scrollback state, rendered through
// terminal-output.tsx. `clear` is special-cased here at the UI layer per
// the comment in lib/commands/impl/clear.ts.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { runCommand } from '@/lib/commands/run';
import type { CommandContext } from '@/lib/commands/types';
import { refCookieName } from '@/lib/refs-cookie';
import {
  TerminalOutput,
  loadScrollback,
  saveScrollback,
  clearScrollback,
  type ScrollbackEntry,
} from './terminal-output';

interface CommandBarProps {
  repoId: string;
  owner: string;
  slug: string;
  /** The real branch write commands target — layout.tsx resolves this to
   * the repo's default branch whenever `detached` is true. */
  branch: string;
  /** T4.1 — what's actually checked out: equals `branch` on a normal
   * checkout, or a tag name / short sha when `detached`. */
  currentRef: string;
  detached: boolean;
  userId: string;
}

export function CommandBar({ repoId, owner, slug, branch, currentRef, detached, userId }: CommandBarProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<ScrollbackEntry[]>([]);
  const [line, setLine] = useState('');
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEntries(loadScrollback(repoId));
  }, [repoId]);

  const ctx: CommandContext = {
    repoId,
    owner,
    slug,
    branch,
    ref: currentRef,
    detached,
    userId,
    // T4.1 — checkout's way of changing what's checked out (see the
    // CommandContext.setRef comment in lib/commands/types.ts). A cookie so
    // the next server render (layout.tsx / page.tsx) picks it up; max-age
    // omitted so it's a session cookie, same lifetime as the scrollback in
    // sessionStorage.
    setRef: (ref) => {
      document.cookie = `${refCookieName(repoId)}=${encodeURIComponent(ref)}; path=/`;
    },
    navigate: (href) => router.push(href),
    refresh: () => router.refresh(),
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = line.trim();
    if (!trimmed || running) return;

    setRunning(true);
    setLine('');

    if (trimmed === 'clear') {
      clearScrollback(repoId);
      setEntries([]);
      setRunning(false);
      return;
    }

    const result = await runCommand(trimmed, ctx);
    setEntries((prev) => {
      const next = [...prev, { line: trimmed, output: result.output }];
      saveScrollback(repoId, next);
      return next;
    });

    if (result.mutated) {
      ctx.refresh();
    }

    setRunning(false);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-white/10 bg-black p-3">
      <div className="max-h-64 overflow-y-auto">
        <TerminalOutput entries={entries} owner={owner} slug={slug} />
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 font-mono text-xs">
        <span className="text-zinc-500">vault&gt;</span>
        <input
          ref={inputRef}
          value={line}
          onChange={(e) => setLine(e.target.value)}
          disabled={running}
          placeholder="help"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </form>
    </div>
  );
}
