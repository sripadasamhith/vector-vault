import { describe, expect, it } from 'vitest';
import { runCommand } from '../run';
import type { CommandContext } from '../types';

function makeCtx(): CommandContext {
  return {
    repoId: 'repo-1',
    owner: 'me',
    slug: 'test-repo',
    branch: 'main',
    userId: 'user-1',
    navigate: () => {},
    refresh: () => {},
  };
}

describe('runCommand', () => {
  it('unknown command -> the exact error format from BUILD.md', async () => {
    const result = await runCommand('frobnicate', makeCtx());
    expect(result.output).toEqual({
      type: 'error',
      message: "vault: 'frobnicate' is not a command. Try 'help'.",
    });
  });

  it('a blank line is a no-op text output, not an error', async () => {
    const result = await runCommand('   ', makeCtx());
    expect(result.output).toEqual({ type: 'text', lines: [] });
  });

  it('an unterminated quote surfaces as an error, not a thrown exception', async () => {
    const result = await runCommand('commit -m "unterminated', makeCtx());
    expect(result.output.type).toBe('error');
  });

  it('help lists every registered command, including itself', async () => {
    const result = await runCommand('help', makeCtx());
    expect(result.output.type).toBe('table');
    if (result.output.type === 'table') {
      const names = result.output.rows.map((r) => r[0]);
      for (const expected of ['help', 'whoami', 'clear', 'status', 'ls', 'log', 'add', 'rm', 'commit']) {
        expect(names).toContain(expected);
      }
    }
  });
});
