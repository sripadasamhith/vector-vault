// T4.4 — PLAN.md §6: `share [<ref>] [--expires 7d]`. Mints a share link and
// prints the URL. Accepts a small duration suffix (d/h/m/s) for --expires;
// no expiry flag means the link never expires.
import type { Command } from '../types';
import { createShare } from '../../client-api';

const DURATION_RE = /^(\d+)([smhd])$/;
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

function parseDuration(raw: string): number | null {
  const match = DURATION_RE.exec(raw);
  if (!match) return null;
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}

export const share: Command = {
  name: 'share',
  summary: 'Mint a read-only share link for a ref.',
  usage: 'share [<ref>] [--expires 7d]',
  async run(args, ctx) {
    const expiresIndex = args.indexOf('--expires');
    let expiresInSeconds: number | undefined;
    if (expiresIndex !== -1) {
      const raw = args[expiresIndex + 1];
      const parsed = raw ? parseDuration(raw) : null;
      if (!parsed) {
        return { output: { type: 'error', message: 'usage: share [<ref>] [--expires <Nd|Nh|Nm|Ns>]' } };
      }
      expiresInSeconds = parsed;
    }

    const positional = args.filter((a, i) => a !== '--expires' && i !== expiresIndex + 1);
    const ref = positional[0];

    const result = await createShare(ctx.repoId, { ref, expiresInSeconds });
    if ('error' in result) {
      return { output: { type: 'error', message: result.error.message } };
    }

    return {
      output: {
        type: 'text',
        lines: [
          `share link created${result.data.expiresAt ? ` (expires ${result.data.expiresAt})` : ''}`,
          result.data.url,
        ],
      },
    };
  },
};
