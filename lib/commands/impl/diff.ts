// T3.3 — PLAN.md §6: `diff [<refA>] [<refB>]`. Default: HEAD vs
// working/staged. One ref: that ref vs HEAD (lib/domain/diff.ts's
// documented defaults). Renders as a { type: 'diff' } CommandOutput
// (ARCHITECTURE.md §3) — terminal-output.tsx renders the summary table and
// links out to the full compare page for the synced 3D view.
import type { Command } from '../types';
import { diffRefs } from '../../client-api';

export const diff: Command = {
  name: 'diff',
  summary: 'Compare geometry between two refs (default: staged vs HEAD).',
  usage: 'diff [<refA>] [<refB>]',
  async run(args, ctx) {
    const [a, b] = args;
    const result = await diffRefs(ctx.repoId, { a, b });
    if ('error' in result) {
      return { output: { type: 'error', message: result.error.message } };
    }
    return { output: { type: 'diff', result: result.data.diff } };
  },
};
