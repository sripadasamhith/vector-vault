// T1.7 — PLAN.md §6: "log [-n N]: commit history from HEAD, newest first".
import type { Command } from '../types';
import { listCommits } from '../../client-api';

export const log: Command = {
  name: 'log',
  summary: 'Show commit history, newest first.',
  usage: 'log [-n <count>]',
  async run(args, ctx) {
    let limit: number | undefined;
    const nIndex = args.indexOf('-n');
    if (nIndex !== -1) {
      const raw = args[nIndex + 1];
      const parsed = Number(raw);
      if (!raw || !Number.isInteger(parsed) || parsed <= 0) {
        return { output: { type: 'error', message: 'usage: log [-n <count>]' } };
      }
      limit = parsed;
    }

    const result = await listCommits(ctx.repoId, { branch: ctx.branch, limit });
    if ('error' in result) {
      return { output: { type: 'error', message: result.error.message } };
    }

    if (result.data.commits.length === 0) {
      return { output: { type: 'text', lines: ['(no commits yet)'] } };
    }

    return {
      output: {
        type: 'table',
        headers: ['sha', 'date', 'message'],
        rows: result.data.commits.map((c) => [
          c.short_sha,
          new Date(c.created_at).toISOString().slice(0, 10),
          c.message,
        ]),
      },
    };
  },
};
