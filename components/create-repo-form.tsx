'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createRepo } from '@/lib/client-api';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;

export function CreateRepoForm() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!SLUG_RE.test(slug)) {
      setError('Slug must be lowercase letters, digits, and dashes, starting with a letter or digit.');
      return;
    }

    setSubmitting(true);
    const result = await createRepo({ slug, name: name || slug });
    setSubmitting(false);

    if ('error' in result) {
      setError(result.error.message);
      return;
    }

    setSlug('');
    setName('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <label htmlFor="repo-slug" className="text-xs text-zinc-600 dark:text-zinc-400">
          Slug
        </label>
        <input
          id="repo-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="bracket-mount"
          className="rounded border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="repo-name" className="text-xs text-zinc-600 dark:text-zinc-400">
          Name (optional)
        </label>
        <input
          id="repo-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bracket mount"
          className="rounded border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !slug}
        className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {submitting ? 'Creating…' : 'Create repo'}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
