// T1.7 — PLAN.md §6: "status: staged files, current branch, HEAD short_sha".
import type { Command } from '../types';
import { listStagedFiles, getCommitAtRef } from '../../client-api';

export const status: Command = {
  name: 'status',
  summary: 'Show staged files, current branch, and HEAD.',
  usage: 'status',
  async run(_args, ctx) {
    const [stagedResult, headResult] = await Promise.all([
      listStagedFiles(ctx.repoId, ctx.branch),
      getCommitAtRef(ctx.repoId, 'HEAD'),
    ]);

    if ('error' in stagedResult) {
      return { output: { type: 'error', message: stagedResult.error.message } };
    }

    const headLine =
      'error' in headResult
        ? 'HEAD    (no commits yet)'
        : `HEAD    ${headResult.data.commit.short_sha}  ${headResult.data.commit.message}`;

    const lines = [`branch  ${ctx.branch}`, headLine, ''];

    if (stagedResult.data.staged.length === 0) {
      lines.push('nothing staged');
    } else {
      lines.push('staged:');
      for (const f of stagedResult.data.staged) {
        lines.push(`  ${f.sha256 === null ? 'deleted' : 'staged '}  ${f.path}`);
      }
    }

    return { output: { type: 'text', lines } };
  },
};
