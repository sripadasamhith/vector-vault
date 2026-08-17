// T1.7 — PLAN.md §6: `rm <path>` stages a deletion.
import type { Command } from '../types';
import { stageRemoval } from '../../client-api';

export const rm: Command = {
  name: 'rm',
  summary: 'Stage a file removal.',
  usage: 'rm <path>',
  async run(args, ctx) {
    const path = args[0];
    if (!path) {
      return { output: { type: 'error', message: 'usage: rm <path>' } };
    }
    // T4.1 — a detached checkout is read-only (BUILD.md T4.1).
    if (ctx.detached) {
      return { output: { type: 'error', message: 'cannot stage in a detached checkout', hint: 'checkout a branch first' } };
    }

    const result = await stageRemoval(ctx.repoId, { path, branch: ctx.branch });
    if ('error' in result) {
      return { output: { type: 'error', message: result.error.message } };
    }

    return {
      output: { type: 'text', lines: [`staged removal  ${path}`] },
      mutated: true,
    };
  },
};
