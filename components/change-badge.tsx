// T3.3 (BUILD.md). A single small presentational piece shared by the
// terminal `diff` output and the compare page's file list — renders a
// ChangeKind (ARCHITECTURE.md §3) as its PLAN.md §5 label, colored.
import type { ChangeKind } from '@/lib/domain/diff';

const LABEL: Record<ChangeKind, string> = {
  unchanged: 'unchanged',
  reexported: 're-exported, geometry equivalent',
  modified: 'modified',
  added: 'added',
  removed: 'removed',
  binary: 'binary change (no analysis)',
};

const COLOR: Record<ChangeKind, string> = {
  unchanged: 'text-zinc-500',
  reexported: 'text-sky-400',
  modified: 'text-amber-400',
  added: 'text-emerald-400',
  removed: 'text-red-400',
  binary: 'text-zinc-400',
};

export function ChangeBadge({ kind }: { kind: ChangeKind }) {
  return <span className={`font-mono text-xs ${COLOR[kind]}`}>{LABEL[kind]}</span>;
}
