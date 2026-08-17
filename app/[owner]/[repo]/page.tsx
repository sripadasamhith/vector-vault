// T1.8 — file browser at the current ref. Server component: calls
// lib/domain/** directly, same pattern as dashboard/page.tsx (T0.6) — RSC
// pages are allowed to, only lib/commands/** and components/** are
// restricted to the HTTP boundary (ARCHITECTURE.md §2).
//
// T4.1 added: the current ref is no longer always HEAD-of-default-branch —
// it's whatever the vv-ref-<repoId> cookie says (set by the `checkout`
// command), the same way layout.tsx resolves it for the banner/CommandBar.
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getRepoByOwnerAndSlug } from '@/lib/domain/repos';
import { resolveRef } from '@/lib/domain/refs';
import { getCommitFiles } from '@/lib/domain/commits';
import { FileList } from '@/components/file-list';
import { UploadPanel } from '@/components/upload-panel';
import { readRefCookie } from '@/lib/refs-cookie';

export default async function RepoFileBrowserPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo: slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // layout.tsx already 404s if the repo isn't visible to this user; a
  // second lookup here is cheap and keeps this page self-contained.
  const repo = await getRepoByOwnerAndSlug(supabase, owner, slug);
  if (!repo) redirect('/dashboard');

  const cookieStore = await cookies();
  const checkedOutRef = readRefCookie(cookieStore, repo.id);
  const ref = checkedOutRef ?? 'HEAD';

  const commit = await resolveRef(supabase, repo.id, ref);
  const files = commit ? await getCommitFiles(supabase, commit.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {commit ? `at ${ref === 'HEAD' ? '' : `${ref} `}${commit.short_sha}` : 'no commits yet'}
        </h2>
        <div className="mt-2">
          <FileList files={files} owner={owner} slug={slug} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Upload</h2>
        <div className="mt-2">
          <UploadPanel repoId={repo.id} branch={repo.default_branch} />
        </div>
      </div>
    </div>
  );
}
