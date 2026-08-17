// T1.7 — PLAN.md §6: `commit -m "<msg>"`. Refuses on empty staging area
// (the API surfaces create_commit()'s nothing_staged error, ARCHITECTURE.md §5).
import type { Command } from '../types';
import { commit as commitApi } from '../../client-api';

export const commit: Command = {
  name: 'commit',
  summary: 'Snapshot staged changes into a new commit.',
  usage: 'commit -m "<message>"',
  async run(args, ctx) {
    const mIndex = args.indexOf('-m');
    const message = mIndex !== -1 ? args[mIndex + 1] : undefined;

    if (!message) {
      return { output: { type: 'error', message: 'usage: commit -m "<message>"' } };
    }
    // T4.1 — a detached checkout is read-only (BUILD.md T4.1).
    if (ctx.detached) {
      return { output: { type: 'error', message: 'cannot commit in a detached checkout', hint: 'checkout a branch first' } };
    }

    const result = await commitApi(ctx.repoId, { message, branch: ctx.branch });

    if ('error' in result) {
      if (result.error.code === 'nothing_staged') {
        return {
          output: {
            type: 'error',
            message: 'nothing staged',
            hint: "stage a file first, e.g. 'add <path>' or upload one",
          },
        };
      }
      return { output: { type: 'error', message: result.error.message } };
    }

    return {
      output: { type: 'text', lines: [`[${ctx.branch} ${result.data.shortSha}] ${message}`] },
      mutated: true,
    };
  },
};
