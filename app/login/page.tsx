'use client';

// T0.5 — magic-link email login only.
//
// GitHub OAuth is listed alongside magic link in PLAN.md §3 and BUILD.md
// T0.5, but this Supabase project has `github: false` in its auth config
// (verified live, not assumed) — there is no GitHub OAuth app wired up on
// either side. Shipping a "Continue with GitHub" button here would be a
// button that cannot work, which BUILD.md rule 6 forbids as a placeholder.
// Deferred; see the commented seam below for where it slots in later.

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setStatus('sent');
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          We&apos;ll email you a link. No password.
        </p>

        {status === 'sent' ? (
          <p className="mt-6 text-sm text-zinc-800 dark:text-zinc-200">
            Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-black/10 bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/15 dark:text-zinc-50 dark:focus:border-white/40"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {status === 'error' && errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            )}
          </form>
        )}

        {/*
          GitHub OAuth seam: once GitHub is enabled in Supabase Auth
          settings, add a second button here calling
          `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: ... } })`.
          auth/callback/route.ts already handles the OAuth code-exchange
          case identically to the magic-link case — no changes needed there.
        */}
      </div>
    </div>
  );
}
