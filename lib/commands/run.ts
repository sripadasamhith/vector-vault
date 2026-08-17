// T1.7 — the single entry point the command bar (T1.8) calls. Tokenizes,
// looks up the command, runs it, and turns any tokenizer/unknown-command
// failure into the same CommandResult shape a command's own run() returns,
// so the caller never has to special-case "the line itself was malformed"
// vs. "the command ran and errored."
import type { CommandContext, CommandResult } from './types';
import { tokenize, TokenizeError } from './tokenize';
import { getCommand } from './registry';

export async function runCommand(line: string, ctx: CommandContext): Promise<CommandResult> {
  let tokens: string[];
  try {
    tokens = tokenize(line);
  } catch (err) {
    const message = err instanceof TokenizeError ? err.message : 'could not parse command line';
    return { output: { type: 'error', message } };
  }

  if (tokens.length === 0) {
    return { output: { type: 'text', lines: [] } };
  }

  const [name, ...args] = tokens;
  const command = getCommand(name);

  if (!command) {
    return {
      output: { type: 'error', message: `vault: '${name}' is not a command. Try 'help'.` },
    };
  }

  try {
    return await command.run(args, ctx);
  } catch (err) {
    return {
      output: {
        type: 'error',
        message: err instanceof Error ? err.message : `'${name}' failed unexpectedly`,
      },
    };
  }
}
