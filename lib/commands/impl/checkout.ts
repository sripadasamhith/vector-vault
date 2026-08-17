// T4.1 — PLAN.md §6: `checkout <ref>` switches branch, or enters a detached
// read-only view at a commit/tag; `checkout <ref> -- <path>` (T4.3's
// resolution advice) stages that one path's version from another ref onto
// the current branch, so a diverged `merge` refusal can actually be acted
// on. Both reuse existing endpoints (getCommitAtRef / stageFile) — no new
// route was needed for either.
import type { Command } from '../types';
import { getCommitAtRef, stageFile } from '../../client-api';

export const checkout: Command = {
  name: 'checkout',
  summary: 'Switch branch, enter a detached view at a ref, or pull one path from another ref.',
  usage: 'checkout <ref> | checkout <ref> -- <path>',
  async run(args, ctx) {
    const sepIndex = args.indexOf('--');

    if (sepIndex !== -1) {
      const ref = args[0];
      const path = args[sepIndex + 1];
      if (!ref || sepIndex !== 1 || !path) {
        return { output: { type: 'error', message: 'usage: checkout <ref> -- <path>' } };
      }
      if (ctx.detached) {
        return {
          output: {
            type: 'error',
            message: 'cannot stage into a detached checkout',
            hint: 'checkout a branch first',
          },
        };
      }

      const atRef = await getCommitAtRef(ctx.repoId, ref);
      if ('error' in atRef) {
        return { output: { type: 'error', message: atRef.error.message } };
      }
      const file = atRef.data.files.find((f) => f.path === path);
      if (!file || !file.sha256) {
        return { output: { type: 'error', message: `no such path at ${ref}: ${path}` } };
      }

      const staged = await stageFile(ctx.repoId, { path, sha256: file.sha256, branch: ctx.branch });
      if ('error' in staged) {
        return { output: { type: 'error', message: staged.error.message } };
      }

      return {
        output: { type: 'text', lines: [`staged ${path} from ${ref} — run 'commit -m "..."' to resolve`] },
        mutated: true,
      };
    }

    const ref = args[0];
    if (!ref) {
      return { output: { type: 'error', message: 'usage: checkout <ref> | checkout <ref> -- <path>' } };
    }

    const result = await getCommitAtRef(ctx.repoId, ref);
    if ('error' in result) {
      return { output: { type: 'error', message: result.error.message } };
    }

    ctx.setRef(ref);

    return {
      output: { type: 'text', lines: [`switched to ${ref} (${result.data.commit.short_sha})`] },
      mutated: true,
    };
  },
};
