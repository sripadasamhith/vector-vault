# Setup — GitHub OAuth and Vercel

Steps that need account access, so they can't be automated from a dev session. Do them in
this order; Vercel first means you'll have the production URL that OAuth needs.

Project ref: `avuolqpjtaaebtbpxmxj` · Repo: `sripadasamhith/vector-vault`

---

## Part 1 — Deploy to Vercel

### 1. Push

```bash
git push origin main
```

`.env.local` is gitignored, so no secrets go up. `fixtures/large.stl` (51 MB) is gitignored
too — regenerate it locally with `python3 fixtures/generate.py` if you ever need it.

### 2. Import the project

[vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
`sripadasamhith/vector-vault`.

Framework preset auto-detects **Next.js**. Leave build command, output directory, and install
command on their defaults — nothing here is custom.

### 3. Environment variables

Before clicking Deploy, expand **Environment Variables** and add all four. Copy the values
from your local `.env.local` — except `NEXT_PUBLIC_APP_URL`, which must point at the
deployment, not localhost:

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://avuolqpjtaaebtbpxmxj.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | All |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | All |
| `NEXT_PUBLIC_APP_URL` | set after first deploy (step 5) | All |

**`SUPABASE_SECRET_KEY` must never gain a `NEXT_PUBLIC_` prefix.** It bypasses Row Level
Security entirely — prefixed, it would be inlined into the JavaScript bundle and served to
every visitor, handing anyone full read/write on every user's repos. Vercel encrypts env vars
at rest either way; the prefix is what decides whether it reaches the browser.

### 4. Deploy

Click **Deploy**. First build takes a couple of minutes. You'll get a URL like
`https://vector-vault-xxxx.vercel.app`.

### 5. Point the app at itself

Vercel → Project → **Settings → Environment Variables** → set `NEXT_PUBLIC_APP_URL` to your
production URL (no trailing slash), then **Deployments → ⋯ → Redeploy**.

This matters because magic-link and OAuth redirects are built from `NEXT_PUBLIC_APP_URL`. Left
on `http://localhost:3000`, every production login bounces someone to their own machine.

### 6. Tell Supabase about the domain

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://vector-vault-xxxx.vercel.app`
- **Redirect URLs** — add both, so local dev keeps working:
  - `http://localhost:3000/**`
  - `https://vector-vault-xxxx.vercel.app/**`

Supabase refuses to redirect anywhere not on this allowlist. A login that lands on
"requested path is invalid" is almost always a missing entry here.

---

## Part 2 — GitHub OAuth

### 1. Create the OAuth app

GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
([github.com/settings/developers](https://github.com/settings/developers)).

| Field | Value |
|---|---|
| Application name | Vector Vault |
| Homepage URL | `https://vector-vault-xxxx.vercel.app` |
| Authorization callback URL | `https://avuolqpjtaaebtbpxmxj.supabase.co/auth/v1/callback` |

**The callback URL is Supabase's, not your app's.** This is the single most common mistake.
The flow is GitHub → Supabase → your app: GitHub hands the code to Supabase, Supabase creates
the session and only then redirects to your app's `/auth/callback`. Putting your own domain
here produces a "redirect_uri mismatch" error at sign-in.

A useful consequence: because the callback belongs to Supabase, **one OAuth app covers both
localhost and production**. You don't need a second app for dev.

### 2. Get the credentials

On the app page, copy the **Client ID**, then **Generate a new client secret** and copy that
too — GitHub shows the secret exactly once.

### 3. Enable the provider in Supabase

Supabase → **Authentication → Providers → GitHub** → toggle on, paste Client ID and Client
Secret, **Save**.

Verify it took:

```bash
curl -s "https://avuolqpjtaaebtbpxmxj.supabase.co/auth/v1/settings" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | grep -o '"github":[a-z]*'
```

Should print `"github":true`. It currently prints `false`.

### 4. The code seam

The login page ships magic-link only, deliberately — a "Continue with GitHub" button against
a disabled provider is a button that always errors. The hook-up point is commented in
`app/login/page.tsx`; `app/auth/callback/route.ts` already handles the OAuth code exchange and
needs no changes.

Once `"github":true`, the button is a few lines:

```ts
await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
});
```

---

## Verifying it worked

```bash
npm run check-env        # env vars present and well-formed
npm run verify:sql       # migrations + RLS + commit model (Docker, no Supabase needed)
npm run verify:phase0    # two real users against the live project — the isolation gate
```

Then, on the deployed URL: sign in, create a repo, sign in as a second account, and confirm
the first account's repo is invisible. That is the Phase 0 exit condition in `BUILD.md`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `redirect_uri mismatch` at GitHub | Callback URL is your domain instead of `…supabase.co/auth/v1/callback` |
| "requested path is invalid" after login | Domain missing from Supabase → Auth → URL Configuration → Redirect URLs |
| **Sign-in redirects to localhost from the deployed app** | The deployed URL is not in **Redirect URLs**, so Supabase discards it and falls back to **Site URL**. Note Supabase does *not* reject a bad `redirect_to` up front — it passes it to GitHub and only validates on the way back, so the failure surfaces at the very end of the flow. Fix both fields: Site URL = the deployed URL, Redirect URLs = `https://<app>.vercel.app/**` *and* `http://localhost:3000/**`. Affects magic link too. |
| Login redirects to localhost in production | `NEXT_PUBLIC_APP_URL` still `http://localhost:3000`; fix and redeploy |
| Supabase client undefined at runtime | A browser-read var lost its `NEXT_PUBLIC_` prefix — only prefixed vars reach the bundle |
| Upload works locally, fails at ~4.5 MB in production | A file is being routed through a Next.js API route; it must go direct to Storage (`ARCHITECTURE.md` §4) |
