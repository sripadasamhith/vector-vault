// T1.7. lib/commands/** never imports Supabase or calls fetch (ARCHITECTURE.md
// §2) — help lists the registry, which is all local data.
import type { Command } from '../types';

export function makeHelp(getAll: () => Command[]): Command {
  return {
    name: 'help',
    summary: 'List available commands.',
    usage: 'help',
    async run() {
      const commands = getAll().sort((a, b) => a.name.localeCompare(b.name));
      return {
        output: {
          type: 'table',
          headers: ['command', 'usage', 'summary'],
          rows: commands.map((c) => [c.name, c.usage, c.summary]),
        },
      };
    },
  };
}
