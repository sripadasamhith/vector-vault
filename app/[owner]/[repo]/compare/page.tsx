// T3.3 (BUILD.md) / ARCHITECTURE.md §1, §8. Dual viewer + metric delta
// table. Server component: calls lib/domain/** directly (RSC pages may,
// per ARCHITECTURE.md §2 — the boundary is on lib/commands/** and
// components/**), same pattern as blob/[...path]/page.tsx.
//
// ?a=&b= pick the two refs (same defaults as GET /api/repos/:id/diff would
// apply, but a page needs *something* to show without query params at all,
// so the no-args default here is "the commit before HEAD vs HEAD" rather
// than staged state — a page reached by clicking around, not typing `diff`,
// has no obvious "current staged" framing). ?path= picks which changed
// file's 3D preview to show; defaults to the first modified/reexported
// (i.e. mesh-comparable) file.
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getRepoByOwnerAndSlug } from '@/lib/domain/repos';
import { resolveRef } from '@/lib/domain/refs';
import { diffCommits, type ChangeKind } from '@/lib/domain/diff';
import { DualViewer } from '@/components/dual-viewer';
import { MetricTable } from '@/components/metric-table';
import { ChangeBadge } from '@/components/change-badge';

const MESH_COMPARABLE: ChangeKind[] = ['modified', 'reexported'];

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ a?: string; b?: string; path?: string }>;
}) {
  const { owner, repo: slug } = await params;
  const { a: aParam, b: bParam, path: pathParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const repo = await getRepoByOwnerAndSlug(supabase, owner, slug);
  if (!repo) redirect('/dashboard');

  const head = await resolveRef(supabase, repo.id, 'HEAD');
  if (!head) notFound();

  const refA = aParam ?? head.parent_id ?? head.short_sha;
  const refB = bParam ?? 'HEAD';

  const diffResult = await diffCommits(supabase, { repoId: repo.id, refA, refB });
  if (!diffResult.ok) {
    return <p className="text-sm text-red-600 dark:text-red-400">{diffResult.message}</p>;
  }
  const { result } = diffResult;

  const header = (
    <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
      Comparing {result.a.ref} ({result.a.shortSha}) &rarr; {result.b.ref} ({result.b.shortSha})
    </h2>
  );

  if (result.changes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <p className="text-sm text-zinc-500">No differences between these refs.</p>
      </div>
    );
  }

  const selected =
    result.changes.find((c) => c.path === pathParam) ??
    result.changes.find((c) => MESH_COMPARABLE.includes(c.kind)) ??
    result.changes[0];

  const canPreview = MESH_COMPARABLE.includes(selected.kind) && selected.shaA && selected.shaB;

  return (
    <div className="flex flex-col gap-6">
      {header}

      {canPreview ? (
        <DualViewer
          shaA={selected.shaA as string}
          filenameA={selected.path}
          shaB={selected.shaB as string}
          filenameB={selected.path}
        />
      ) : (
        <p className="text-sm text-zinc-500">
          No 3D preview available for {selected.path} ({selected.kind}).
        </p>
      )}

      <MetricTable change={selected} aShort={result.a.shortSha} bShort={result.b.shortSha} />

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          All changed files
        </h3>
        <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
          {result.changes.map((c) => (
            <li key={c.path} className="flex items-center gap-3">
              <Link
                href={`/${owner}/${slug}/compare?a=${encodeURIComponent(refA)}&b=${encodeURIComponent(refB)}&path=${encodeURIComponent(c.path)}`}
                className={
                  c.path === selected.path
                    ? 'text-black underline decoration-solid underline-offset-2 dark:text-zinc-50'
                    : 'text-zinc-700 underline decoration-dotted underline-offset-2 hover:decoration-solid dark:text-zinc-300'
                }
              >
                {c.path}
              </Link>
              <ChangeBadge kind={c.kind} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
