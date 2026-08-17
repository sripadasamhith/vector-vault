// T3.3 (BUILD.md). Renders one FileChange's MetricDelta[] — the delta table
// mocked up in PLAN.md §8 — plus the C7 disclosure line, which BUILD.md
// requires verbatim in the compare UI:
//
//   "Vector Vault reports that geometry changed and by how much. It does
//   not yet show where."
import type { FileChange } from '@/lib/domain/diff';
import { ChangeBadge } from './change-badge';

export function MetricTable({
  change,
  aShort,
  bShort,
}: {
  change: FileChange;
  aShort: string;
  bShort: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded border border-black/10 p-4 font-mono text-xs dark:border-white/10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-black dark:text-zinc-100">{change.path}</span>
        <span className="text-zinc-500">
          {aShort} → {bShort}
        </span>
        <ChangeBadge kind={change.kind} />
      </div>

      {change.deltas.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-left">
            <tbody>
              {change.deltas.map((d) => (
                <tr key={d.label}>
                  <td className="py-1 pr-4 text-zinc-500">{d.label}</td>
                  <td className="py-1 pr-4 text-black dark:text-zinc-200">
                    {d.a ?? '—'} → {d.b ?? '—'}
                  </td>
                  <td className={`py-1 ${d.significant ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-500'}`}>
                    {d.deltaPct === null
                      ? d.a === d.b
                        ? 'unchanged'
                        : ''
                      : `${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-zinc-500">No metric comparison available for this file.</p>
      )}

      <p className="border-t border-black/10 pt-3 text-zinc-500 dark:border-white/10">
        ⓘ Vector Vault reports that geometry changed and by how much. It does not yet show where.
      </p>
    </div>
  );
}
