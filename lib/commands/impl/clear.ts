// T1.7. `clear` is special: clearing the terminal scrollback is a UI-only
// action, not something CommandOutput (ARCHITECTURE.md §3) has a variant
// for. This command returns an empty text output as its formal result;
// components/terminal-output.tsx (T1.8) special-cases the *command name*
// "clear" to also wipe its own rendered history and sessionStorage — the
// same way a real terminal's `clear` is handled by the emulator, not by the
// program's stdout.
import type { Command } from '../types';

export const clear: Command = {
  name: 'clear',
  summary: 'Clear the terminal scrollback.',
  usage: 'clear',
  async run() {
    return { output: { type: 'text', lines: [] } };
  },
};
