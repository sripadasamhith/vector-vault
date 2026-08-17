// T1.7 — PLAN.md §6: `add <path> | add .`. The upload dropzone (T1.3/T1.8)
// stages a freshly uploaded file automatically, so `add`'s job in this
// snapshot-based model (ARCHITECTURE.md §5 — no working tree distinct from
// HEAD) is to (re-)stage a path that is already part of HEAD, using its
// current sha256 — chiefly to undo a staged `rm` before committing.
import type { Command } from '../types';
import { getCommitAtRef, stageFile } from '../../client-api';

export const add: Command = {
  name: 'add',
  summary: 'Stage a path already known at HEAD (e.g. to undo a staged rm).',
  usage: 'add <path> | add .',
  async run(args, ctx) {
    const target = args[0];
    if (!target) {
      return { output: { type: 'error', message: 'usage: add <path> | add .' } };
    }
    // T4.1 — a detached checkout is read-only (BUILD.md T4.1).
    if (ctx.detached) {
      return { output: { type: 'error', message: 'cannot stage in a detached checkout', hint: 'checkout a branch first' } };
    }

    const headResult = await getCommitAtRef(ctx.repoId, 'HEAD');
    if ('error' in headResult) {
      return { output: { type: 'error', message: headResult.error.message } };
    }

    const candidates =
      target === '.'
        ? headResult.data.files
        : headResult.data.files.filter((f) => f.path === target);

    if (candidates.length === 0) {
      return {
        output: {
          type: 'error',
          message: `no such path at HEAD: ${target}`,
          hint: 'new files are staged automatically when uploaded',
        },
      };
    }

    const staged: string[] = [];
    for (const file of candidates) {
      if (!file.sha256) continue;
      const result = await stageFile(ctx.repoId, {
        path: file.path,
        sha256: file.sha256,
        branch: ctx.branch,
      });
      if ('error' in result) {
        return { output: { type: 'error', message: result.error.message } };
      }
      staged.push(file.path);
    }

    return {
      output: { type: 'text', lines: staged.map((p) => `staged  ${p}`) },
      mutated: true,
    };
  },
};
