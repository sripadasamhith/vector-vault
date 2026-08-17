// T4.2 — PLAN.md §6: `revert <ref>`. Creates a NEW commit restoring that
// ref's file set; never rewrites history (the API layer enforces this by
// always calling create_commit(), never deleting or updating existing
// commit rows — see lib/domain/revert.ts).
import type { Command } from '../types';
import { revertToRef } from '../../client-api';

export const revert: Command = {
  name: 'revert',
  summary: 'Create a new commit restoring a ref\'s file set.',
  usage: 'revert <ref>',
  async run(args, ctx) {
    const ref = args[0];
    if (!ref) {
      return { output: { type: 'error', message: 'usage: revert <ref>' } };
    }
    if (ctx.detached) {
      return {
        output: { type: 'error', message: 'cannot revert in a detached checkout', hint: 'checkout a branch first' },
      };
    }

    const result = await revertToRef(ctx.repoId, { ref, branch: ctx.branch });
    if ('error' in result) {
      if (result.error.code === 'nothing_staged') {
        return { output: { type: 'error', message: result.error.message } };
      }
      return { output: { type: 'error', message: result.error.message } };
    }

    return {
      output: {
        type: 'text',
        lines: [`[${result.data.branch} ${result.data.shortSha}] Revert to ${ref}`],
      },
      mutated: true,
    };
  },
};
