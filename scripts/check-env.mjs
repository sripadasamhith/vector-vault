#!/usr/bin/env node
/**
 * Preflight check for .env.local.
 *
 * Validates that the vars the app actually reads are present and well-formed,
 * WITHOUT printing any secret values — only lengths, prefixes, and verdicts.
 * Run with: npm run check-env
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), '.env.local');

if (!existsSync(FILE)) {
  console.error('✗ .env.local not found at', FILE);
  process.exit(1);
}

const env = {};
for (const line of readFileSync(FILE, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  env[t.slice(0, i).trim()] = v;
}

const problems = [];
const notes = [];

function check(name, { required = true, browser = false, validate, hint }) {
  const v = env[name];
  if (!v) {
    if (required) problems.push(`${name} is missing or empty${hint ? ` — ${hint}` : ''}`);
    return;
  }
  if (browser && !name.startsWith('NEXT_PUBLIC_')) {
    problems.push(`${name} must be prefixed NEXT_PUBLIC_ to reach the browser`);
  }
  const err = validate?.(v);
  if (err) problems.push(`${name}: ${err}`);
  else console.log(`  ✓ ${name}  (${v.length} chars, starts "${v.slice(0, 14)}…")`);
}

console.log('Checking .env.local\n');

check('NEXT_PUBLIC_SUPABASE_URL', {
  browser: true,
  hint: 'Supabase → Settings → Data API → Project URL',
  validate: (v) =>
    /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(v)
      ? null
      : 'expected https://<project-ref>.supabase.co',
});

check('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', {
  browser: true,
  hint: 'Supabase → Settings → API Keys → Publishable key',
  validate: (v) => {
    if (v.startsWith('sb_secret_')) return 'this is a SECRET key — never expose it as NEXT_PUBLIC_';
    if (v.startsWith('sb_publishable_')) return null;
    if (v.startsWith('eyJ')) { notes.push('publishable key is a legacy anon JWT — works, but Supabase is migrating to sb_publishable_'); return null; }
    return 'expected a key starting sb_publishable_';
  },
});

check('SUPABASE_SECRET_KEY', {
  hint: 'Supabase → Settings → API Keys → Secret keys → Reveal',
  validate: (v) => {
    if (v.startsWith('sb_publishable_')) return 'this is the PUBLISHABLE key, not the secret key';
    if (v.startsWith('sb_secret_')) return null;
    if (v.startsWith('eyJ')) { notes.push('secret key is a legacy service_role JWT — works, but is being replaced by sb_secret_'); return null; }
    return 'expected a key starting sb_secret_';
  },
});

check('NEXT_PUBLIC_APP_URL', {
  browser: true,
  validate: (v) => (/^https?:\/\//.test(v) ? null : 'expected an http(s) URL'),
});

// Safety: the secret key must never be browser-exposed, under any name.
for (const [k, v] of Object.entries(env)) {
  if (k.startsWith('NEXT_PUBLIC_') && v.startsWith('sb_secret_')) {
    problems.push(`${k} exposes a secret key to the browser — rename it without NEXT_PUBLIC_`);
  }
}

// Vars people commonly add that this app does not use.
for (const k of ['SUPABASE_JWKS_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (env[k]) notes.push(`${k} is set but unused by this app — harmless, safe to remove`);
}
for (const k of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) {
  if (env[k] && !env[`NEXT_PUBLIC_${k.replace('SUPABASE_', 'SUPABASE_')}`]) {
    notes.push(`${k} has no NEXT_PUBLIC_ prefix, so the browser cannot read it — rename to NEXT_PUBLIC_${k}`);
  }
}

console.log();
for (const n of notes) console.log(`  ⓘ ${n}`);
if (notes.length) console.log();

if (problems.length) {
  console.error('✗ Not ready:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nSee BUILD.md T0.2.');
  process.exit(1);
}

console.log('✓ Environment looks good. Ready for T0.3 (schema migration).');
