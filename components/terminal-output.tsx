'use client';

// T1.8. Renders the command-bar scrollback. Persistence lives here (keyed
// by repo id, per BUILD.md T1.7) rather than in command-bar.tsx, so the
// storage concern stays with the thing that's purely presentational about
// history — command-bar.tsx owns *running* commands, this owns *showing*
// past runs.
import { useEffect, useState } from 'react';
import type { CommandOutput } from '@/lib/commands/types';

export interface ScrollbackEntry {
  line: string;
  output: CommandOutput;
}

function storageKey(repoId: string) {
  return `vault:scrollback:${repoId}`;
}

export function loadScrollback(repoId: string): ScrollbackEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(repoId));
    return raw ? (JSON.parse(raw) as ScrollbackEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveScrollback(repoId: string, entries: ScrollbackEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey(repoId), JSON.stringify(entries));
  } catch {
    // sessionStorage full or unavailable (private browsing) — scrollback
    // just won't persist across reloads. Not worth surfacing as an error.
  }
}

export function clearScrollback(repoId: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(storageKey(repoId));
}

function OutputBlock({ output }: { output: CommandOutput }) {
  if (output.type === 'text') {
    if (output.lines.length === 0) return null;
    return (
      <pre className="whitespace-pre-wrap text-zinc-300">{output.lines.join('\n')}</pre>
    );
  }

  if (output.type === 'error') {
    return (
      <div className="text-red-400">
        <p>vault: {output.message}</p>
        {output.hint && <p className="text-red-300/80">hint: {output.hint}</p>}
      </div>
    );
  }

  if (output.type === 'table') {
    return (
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {output.headers.map((h) => (
              <th key={h} className="border-b border-white/10 pb-1 pr-4 font-medium text-zinc-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {output.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="pr-4 py-0.5 text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // 'diff' — wired up in T3.3. Placeholder that doesn't lie about content.
  return <p className="text-zinc-500">(diff output — see the compare page)</p>;
}

interface TerminalOutputProps {
  entries: ScrollbackEntry[];
}

export function TerminalOutput({ entries }: TerminalOutputProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid an SSR/CSR mismatch: sessionStorage-derived content only renders
  // client-side.
  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-3 overflow-y-auto font-mono text-xs">
      {entries.map((entry, i) => (
        <div key={i}>
          <p className="text-zinc-500">
            vault&gt; <span className="text-zinc-200">{entry.line}</span>
          </p>
          <div className="mt-1">
            <OutputBlock output={entry.output} />
          </div>
        </div>
      ))}
    </div>
  );
}
