// T4.2 — PLAN.md §6: `tag` (list) and `tag <name> [<ref>]` (create,
// defaulting to HEAD).
import type { Command } from '../types';
import { listTags, createTag } from '../../client-api';

export const tag: Command = {
  name: 'tag',
  summary: 'List tags, or name a commit.',
  usage: 'tag [<name> [<ref>]]',
  async run(args, ctx) {
    const name = args[0];

    if (!name) {
      const result = await listTags(ctx.repoId);
      if ('error' in result) {
        return { output: { type: 'error', message: result.error.message } };
      }
      if (result.data.tags.length === 0) {
        return { output: { type: 'text', lines: ['(no tags)'] } };
      }
      return {
        output: {
          type: 'table',
          headers: ['tag', 'commit', 'note'],
          rows: result.data.tags.map((t) => [t.name, t.short_sha, t.note ?? '']),
        },
      };
    }

    const ref = args[1];
    const result = await createTag(ctx.repoId, { name, ref });
    if ('error' in result) {
      return { output: { type: 'error', message: result.error.message } };
    }

    return {
      output: { type: 'text', lines: [`tag "${name}" -> ${result.data.tag.short_sha}`] },
      mutated: true,
    };
  },
};
