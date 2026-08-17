// T1.7 — PLAN.md §6: "ls [<ref>]: files at a ref, with size and format".
import type { Command } from '../types';
import { getCommitAtRef } from '../../client-api';

function formatSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export const ls: Command = {
  name: 'ls',
  summary: 'List files at a ref (default HEAD).',
  usage: 'ls [<ref>]',
  async run(args, ctx) {
    const ref = args[0] ?? 'HEAD';
    const result = await getCommitAtRef(ctx.repoId, ref);

    if ('error' in result) {
      return {
        output: {
          type: 'error',
          message: result.error.message,
          hint: ref === 'HEAD' ? 'This repo has no commits yet.' : undefined,
        },
      };
    }

    const files = result.data.files;
    if (files.length === 0) {
      return { output: { type: 'text', lines: [`(no files at ${ref})`] } };
    }

    return {
      output: {
        type: 'table',
        headers: ['path', 'size', 'sha256'],
        rows: files.map((f) => [f.path, formatSize(f.sizeBytes), (f.sha256 ?? '').slice(0, 7)]),
      },
    };
  },
};
