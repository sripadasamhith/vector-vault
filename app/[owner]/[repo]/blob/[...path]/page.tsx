// T2.5 (BUILD.md) / ARCHITECTURE.md §1. Single-file viewer at HEAD. Server
// component: resolves the ref and file snapshot the same way page.tsx
// (T1.8) does, then hands the sha256 + path to the client-side
// <BlobViewer>, which does the actual fetch/parse/render work — RSC pages
// may call lib/domain/** directly (ARCHITECTURE.md §2's boundary is on
// lib/commands/** and components/**, not app/**).
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRepoByOwnerAndSlug } from '@/lib/domain/repos';
import { resolveRef } from '@/lib/domain/refs';
import { getCommitFiles } from '@/lib/domain/commits';
import { BlobViewer } from '@/components/blob-viewer';

export default async function BlobViewerPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; path: string[] }>;
}) {
  const { owner, repo: slug, path: pathSegments } = await params;
  const path = pathSegments.map(decodeURIComponent).join('/');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const repo = await getRepoByOwnerAndSlug(supabase, owner, slug);
  if (!repo) redirect('/dashboard');

  const head = await resolveRef(supabase, repo.id, 'HEAD');
  if (!head) notFound();

  const files = await getCommitFiles(supabase, head.id);
  const file = files.find((f) => f.path === path);
  if (!file || !file.sha256) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-mono text-sm text-black dark:text-zinc-100">{path}</h2>
        <p className="text-xs text-zinc-500">at {head.short_sha}</p>
      </div>
      <BlobViewer sha256={file.sha256} filename={path} />
    </div>
  );
}
