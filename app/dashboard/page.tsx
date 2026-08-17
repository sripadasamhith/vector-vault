import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listOwnedRepos } from '@/lib/domain/repos';
import { CreateRepoForm } from '@/components/create-repo-form';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const repos = await listOwnedRepos(supabase, user.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Your repos</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>
      </div>

      <CreateRepoForm />

      {repos.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No repos yet. Pick a slug above and click &quot;Create repo&quot; — you can upload
          your first CAD file right after.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
          {repos.map((repo) => (
            <li key={repo.id} className="flex items-center justify-between py-3">
              <Link href={`/${repo.owner_id}/${repo.slug}`} className="group">
                <span className="font-medium text-black group-hover:underline dark:text-zinc-50">
                  {repo.name}
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">{repo.slug}</p>
              </Link>
              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                {repo.visibility}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
