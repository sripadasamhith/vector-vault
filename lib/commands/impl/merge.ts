// T4.3 — PLAN.md §6 / constraint C5: `merge <ref>`. Fast-forward succeeds
// silently (pointer movement, no new commit needed); on divergence, prints
// the exact refusal text from PLAN.md §6 verbatim (built server-side in
// app/api/repos/[id]/merge/route.ts) as plain lines — not through the
// generic 'error' output, which would prepend its own "vault: " prefix and
// double it, since the refusal text already starts with "vault: ".
import type { Command } from '../types';
import { mergeBranch } from '../../client-api';

export const merge: Command = {
  name: 'merge',
  summary: 'Fast-forward the current branch, or refuse on divergence.',
  usage: 'merge <ref>',
  async run(args, ctx) {
    const source = args[0];
    if (!source) {
      return { output: { type: 'error', message: 'usage: merge <ref>' } };
    }
    if (ctx.detached) {
      return {
        output: { type: 'error', message: 'cannot merge into a detached checkout', hint: 'checkout a branch first' },
      };
    }

    const result = await mergeBranch(ctx.repoId, { source, target: ctx.branch });
    if ('error' in result) {
      if (result.error.code === 'cannot_merge') {
        return { output: { type: 'text', lines: result.error.message.split('\n') } };
      }
      return { output: { type: 'error', message: result.error.message } };
    }

    if (result.data.kind === 'up-to-date') {
      return { output: { type: 'text', lines: [`${ctx.branch} is already up to date with ${source}`] } };
    }

    return {
      output: { type: 'text', lines: [`Fast-forward  ${ctx.branch} -> ${result.data.shortSha}`] },
      mutated: true,
    };
  },
};
