// T1.8 (BUILD.md) / ARCHITECTURE.md §1. Loads the repo + branches + auth,
// renders the always-visible CommandBar around whatever page.tsx /
// commits/page.tsx / etc. render as children. `owner` is the owner's user
// id (see the comment on getRepoByOwnerAndSlug in lib/domain/repos.ts —
// there's no username table in this schema).
//
// T4.1 added: reads the vv-ref-<repoId> cookie (lib/refs-cookie.ts) to know
// what's currently checked out. If it names a real branch, this is a normal
// branch view. Otherwise (a tag name, a short sha, or an unknown string)
// it's a detached read-only checkout — resolved via resolveRef the same
// way every other ref-taking operation is, and rendered with a visible
// banner per BUILD.md T4.1.
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getRepoByOwnerAndSlug, listBranches } from '@/lib/domain/repos';
import { resolveRef } from '@/lib/domain/refs';
import { CommandBar } from '@/components/command-bar';
import { readRefCookie } from '@/lib/refs-cookie';

export default async function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo: slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const repo = await getRepoByOwnerAndSlug(supabase, owner, slug);
  if (!repo) {
    notFound();
  }

  const cookieStore = await cookies();
  const checkedOutRef = readRefCookie(cookieStore, repo.id);

  const branches = await listBranches(supabase, repo.id);
  const isRealBranch = checkedOutRef !== null && branches.some((b) => b.name === checkedOutRef);
  const detached = checkedOutRef !== null && !isRealBranch;

  const currentRef = checkedOutRef ?? repo.default_branch;
  const workingBranch = isRealBranch ? (checkedOutRef as string) : repo.default_branch;

  let detachedCommit = null;
  if (detached) {
    detachedCommit = await resolveRef(supabase, repo.id, currentRef);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          {owner}/{slug}
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {repo.visibility} · default branch {repo.default_branch}
        </p>
      </div>

      {detached && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <strong>Detached checkout</strong> — viewing{' '}
          {detachedCommit ? `${currentRef} (${detachedCommit.short_sha})` : currentRef}, read-only. Run{' '}
          <code className="font-mono">checkout {repo.default_branch}</code> to go back to a branch.
        </div>
      )}

      {children}

      <CommandBar
        repoId={repo.id}
        owner={owner}
        slug={slug}
        branch={workingBranch}
        currentRef={currentRef}
        detached={detached}
        userId={user.id}
      />
    </div>
  );
}
