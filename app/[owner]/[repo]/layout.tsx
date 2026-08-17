// T1.8 (BUILD.md) / ARCHITECTURE.md §1. Loads the repo + branches + auth,
// renders the always-visible CommandBar around whatever page.tsx /
// commits/page.tsx / etc. render as children. `owner` is the owner's user
// id (see the comment on getRepoByOwnerAndSlug in lib/domain/repos.ts —
// there's no username table in this schema).
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRepoByOwnerAndSlug } from '@/lib/domain/repos';
import { CommandBar } from '@/components/command-bar';

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

      {children}

      <CommandBar repoId={repo.id} owner={owner} slug={slug} branch={repo.default_branch} userId={user.id} />
    </div>
  );
}
