// T4.1 — the currently checked-out ref for a repo is client-chosen state
// (which branch, tag, or sha the file browser + command bar should show),
// not something the server tracks per user. A cookie is the simplest way
// to make a client-side choice (command-bar.tsx's checkout command)
// visible to server components (layout.tsx, page.tsx) on the next render,
// without adding a database table for it. Pure string handling only — no
// Supabase, no fetch (this file is imported from both server and client
// code, including lib/commands/impl/checkout.ts's caller).
export function refCookieName(repoId: string): string {
  return `vv-ref-${repoId}`;
}

/** Reads the checked-out ref for `repoId` out of a cookie jar shaped like
 * next/headers' ReadonlyRequestCookies (get(name) => {value}|undefined) or
 * a plain Record<string,string>. Returns null when nothing is set (meaning
 * "the repo's default branch"). */
export function readRefCookie(
  cookies: { get(name: string): { value: string } | undefined } | Record<string, string>,
  repoId: string
): string | null {
  const name = refCookieName(repoId);
  if (typeof (cookies as { get?: unknown }).get === 'function') {
    const entry = (cookies as { get(name: string): { value: string } | undefined }).get(name);
    return entry?.value ?? null;
  }
  return (cookies as Record<string, string>)[name] ?? null;
}
