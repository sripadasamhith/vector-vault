// T1.7. CommandContext (ARCHITECTURE.md §3) carries userId but not email —
// that's all whoami can honestly report without adding a field to the
// shared contract, which is imported, never redeclared.
import type { Command } from '../types';

export const whoami: Command = {
  name: 'whoami',
  summary: 'Show the signed-in user and current repo/branch.',
  usage: 'whoami',
  async run(_args, ctx) {
    return {
      output: {
        type: 'text',
        lines: [`user   ${ctx.userId}`, `repo   ${ctx.owner}/${ctx.slug}`, `branch ${ctx.branch}`],
      },
    };
  },
};
