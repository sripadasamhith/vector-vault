// T4.1 — PLAN.md §6: `branch [<name>]`. No args: list branches. With a
// name: create one starting at the currently checked-out ref (ctx.ref —
// BUILD.md T4.1: "Branch creation starts at the current HEAD"), which is
// either the current branch name or, in a detached checkout, the pinned
// tag/sha.
import type { Command } from '../types';
import { listBranches, createBranch } from '../../client-api';

export const branch: Command = {
  name: 'branch',
  summary: 'List branches, or create one at the current ref.',
  usage: 'branch [<name>]',
  async run(args, ctx) {
    const name = args[0];

    if (!name) {
      const result = await listBranches(ctx.repoId);
      if ('error' in result) {
        return { output: { type: 'error', message: result.error.message } };
      }
      const branches = result.data.branches;
      if (branches.length === 0) {
        return { output: { type: 'text', lines: ['(no branches)'] } };
      }
      return {
        output: {
          type: 'table',
          headers: ['branch', 'head'],
          rows: branches.map((b) => [
            b.name === ctx.ref && !ctx.detached ? `* ${b.name}` : b.name,
            b.head_id ? b.head_id.slice(0, 8) : '(no commits)',
          ]),
        },
      };
    }

    const result = await createBranch(ctx.repoId, { name, from: ctx.ref });
    if ('error' in result) {
      return { output: { type: 'error', message: result.error.message } };
    }

    return {
      output: { type: 'text', lines: [`branch "${name}" created at ${ctx.ref}`] },
      mutated: true,
    };
  },
};
