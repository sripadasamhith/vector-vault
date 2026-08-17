// T4.3 (BUILD.md) — POST /api/repos/:id/merge (writer+). Not in
// ARCHITECTURE.md §1's original route list (see the comment atop
// lib/domain/merge.ts for why this route exists at all). Parses,
// validates, and delegates to lib/domain/merge.ts; no query logic here
// (ARCHITECTURE.md §2).
//
// On divergence returns `cannot_merge` with the exact PLAN.md §6 refusal
// text, built from the diverged file list — never generic. No commit or
// branch mutation happens on that path (lib/domain/merge.ts returns before
// writing anything).
import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { mergeBranch } from '@/lib/domain/merge';
import { getDefaultBranch } from '@/lib/domain/repos';

const mergeSchema = z.object({
  source: z.string().min(1).max(255),
  target: z.string().min(1).max(255).optional(),
});

function refusalMessage(sourceRef: string, targetBranch: string, files: string[]): string {
  const fileLines = files.map((f) => `       ${f} diverged in both branches.`).join('\n');
  const resolveLines = files
    .map(
      (f) =>
        `         vault checkout ${sourceRef} -- ${f}\n         vault checkout ${targetBranch} -- ${f}`
    )
    .join('\n');
  return [
    'vault: geometry cannot be merged automatically.',
    fileLines,
    '       Resolve by choosing a side:',
    resolveLines,
  ].join('\n');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'writer');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const target = parsed.data.target ?? (await getDefaultBranch(auth.supabase, repoId));

  const result = await mergeBranch(auth.supabase, {
    repoId,
    targetBranch: target,
    sourceRef: parsed.data.source,
  });

  if (!result.ok) {
    if (result.kind === 'not_found') {
      return fail('not_found', result.message);
    }
    // diverged
    return fail(
      'cannot_merge',
      refusalMessage(parsed.data.source, target, result.divergedFiles),
      result.divergedFiles.length > 0 ? undefined : 'branches have diverged with no single conflicting file'
    );
  }

  if (result.kind === 'up-to-date') {
    return ok({ kind: 'up-to-date', branch: target });
  }

  return ok({ kind: 'fast-forward', branch: target, shortSha: result.shortSha });
}
