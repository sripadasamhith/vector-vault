'use client';

// T1.8. Renders the command-bar scrollback. Persistence lives here (keyed
// by repo id, per BUILD.md T1.7) rather than in command-bar.tsx, so the
// storage concern stays with the thing that's purely presentational about
// history — command-bar.tsx owns *running* commands, this owns *showing*
// past runs.
import { useEffect, useState } from 'react';
import type { CommandOutput } from '@/lib/commands/types';
import { ChangeBadge } from './change-badge';

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

function OutputBlock({ output, owner, slug }: { output: CommandOutput; owner: string; slug: string }) {
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left">
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
      </div>
    );
  }

  // 'diff' (T3.3) — a compact summary table; the synced dual 3D view lives
  // on the compare page, linked per changed path.
  const { result } = output;
  if (result.changes.length === 0) {
    return (
      <p className="text-zinc-500">
        no differences between {result.a.ref} and {result.b.ref}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-zinc-500">
        {result.a.ref} ({result.a.shortSha}) → {result.b.ref} ({result.b.shortSha})
      </p>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[280px] border-collapse text-left">
        <tbody>
          {result.changes.map((c) => (
            <tr key={c.path}>
              <td className="py-0.5 pr-4 text-zinc-300">{c.path}</td>
              <td className="py-0.5 pr-4">
                <ChangeBadge kind={c.kind} />
              </td>
              <td className="py-0.5">
                <a
                  href={`/${owner}/${slug}/compare?a=${encodeURIComponent(result.a.ref)}&b=${encodeURIComponent(result.b.ref)}&path=${encodeURIComponent(c.path)}`}
                  className="text-sky-400 underline decoration-dotted underline-offset-2 hover:decoration-solid"
                >
                  compare →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="mt-1 text-zinc-600">
        Vector Vault reports that geometry changed and by how much. It does not yet show where.
      </p>
    </div>
  );
}

interface TerminalOutputProps {
  entries: ScrollbackEntry[];
  owner: string;
  slug: string;
}

export function TerminalOutput({ entries, owner, slug }: TerminalOutputProps) {
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
            <OutputBlock output={entry.output} owner={owner} slug={slug} />
          </div>
        </div>
      ))}
    </div>
  );
}
