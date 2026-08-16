'use client';

// T0.5 — magic-link email login plus GitHub OAuth.
//
// GitHub was enabled in this project's Supabase Auth config on 2026-08-16
// (verified live: auth/v1/settings reports `"github": true`), so the button
// below is live rather than a placeholder.
//
// Note the redirect chain: GitHub sends its code to Supabase's own callback
// (https://<ref>.supabase.co/auth/v1/callback, configured in the GitHub
// OAuth app), Supabase mints the session, and only then redirects here to
// `redirectTo`. That is why this value is our app's /auth/callback and not
// GitHub's. See docs/SETUP.md.

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  async function handleGitHub() {
    setOauthPending(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    });

    // On success the browser navigates to GitHub, so this only runs on failure.
    if (error) {
      setOauthPending(false);
      setStatus('error');
      setErrorMessage(error.message);
    }
  }

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

        {status !== 'sent' && (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              <span className="text-xs uppercase tracking-wide text-zinc-500">or</span>
              <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGitHub}
              disabled={oauthPending}
              className="flex w-full items-center justify-center gap-2 rounded border border-black/15 px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:text-zinc-50 dark:hover:bg-white/10"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              {oauthPending ? 'Redirecting…' : 'Continue with GitHub'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
