#!/usr/bin/env node
/**
 * Phase 0 exit gate (BUILD.md): "two accounts cannot see each other's
 * repos." Email confirmation is on in this project and no human here can
 * click a magic link, so this automates the check via the Supabase admin
 * and REST APIs directly — no Next.js server needs to be running.
 *
 * This script is the one permitted place outside lib/supabase/admin.ts that
 * touches the service-role key (ARCHITECTURE.md §2 restricts admin.ts to a
 * single *importer*; this script never imports it, it reads
 * SUPABASE_SECRET_KEY from the environment directly, as instructed).
 *
 * Requires the three migrations in supabase/migrations/ to already be
 * applied by hand (see supabase/APPLY.md) — this script cannot apply DDL.
 *
 * Usage: npm run verify:phase0
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// --- env loading (no dotenv dependency; mirrors scripts/check-env.mjs) ---
function loadEnv() {
  const file = join(process.cwd(), '.env.local');
  const env = { ...process.env };
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      const k = t.slice(0, i).trim();
      if (!(k in process.env)) env[k] = v; // real env wins over .env.local
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = env.SUPABASE_SECRET_KEY;

for (const [name, value] of [
  ['NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL],
  ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ANON_KEY],
  ['SUPABASE_SECRET_KEY', SECRET_KEY],
]) {
  if (!value) {
    console.error(`✗ ${name} is not set. Run \`npm run check-env\` first.`);
    process.exit(1);
  }
}

const STAMP = Date.now();
const PASSWORD = `vv-Test-Pw-${STAMP}!`;

const adminHeaders = {
  apikey: SECRET_KEY,
  Authorization: `Bearer ${SECRET_KEY}`,
  'Content-Type': 'application/json',
};

let failures = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    failures++;
    console.error(`  ✗ ${message}`);
  }
}

async function createTestUser(label) {
  const email = `vv-test-${label}+${STAMP}@example.com`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`admin create user (${label}) failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { id: body.id, email };
}

async function signIn(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`sign-in for ${email} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

async function deleteTestUser(id) {
  if (!id) return;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    console.error(`  ⚠ failed to delete test user ${id}: ${res.status} ${body}`);
  }
}

function restHeaders(accessToken) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function main() {
  console.log(`Phase 0 verification — stamp ${STAMP}\n`);

  console.log('Creating two disposable users...');
  const userA = await createTestUser('a');
  const userB = await createTestUser('b');
  console.log(`  A: ${userA.email}`);
  console.log(`  B: ${userB.email}\n`);

  console.log('Signing both in for JWTs...');
  const tokenA = await signIn(userA.email);
  const tokenB = await signIn(userB.email);
  console.log('  ✓ both sessions obtained\n');

  let repoId = null;

  try {
    console.log("As user A, creating a repo directly against PostgREST...");
    const slug = `phase0-${STAMP}`;
    const createRes = await fetch(`${SUPABASE_URL}/rest/v1/repos`, {
      method: 'POST',
      headers: { ...restHeaders(tokenA), Prefer: 'return=representation' },
      body: JSON.stringify({ owner_id: userA.id, slug, name: 'phase0 verify repo' }),
    });
    const createBody = await createRes.json();
    assert(
      createRes.ok && Array.isArray(createBody) && createBody.length === 1,
      `user A can create a repo (status ${createRes.status})`
    );
    repoId = createBody?.[0]?.id ?? null;
    if (!repoId) {
      throw new Error(`could not read repo id from create response: ${JSON.stringify(createBody)}`);
    }
    console.log(`  repo id: ${repoId}\n`);

    console.log("As user A, creating the 'main' branch row (head_id null)...");
    const branchRes = await fetch(`${SUPABASE_URL}/rest/v1/branches`, {
      method: 'POST',
      headers: { ...restHeaders(tokenA), Prefer: 'return=representation' },
      body: JSON.stringify({ repo_id: repoId, name: 'main', head_id: null }),
    });
    assert(branchRes.ok, `main branch row created (status ${branchRes.status})`);

    console.log("As user A, adding the 'owner' repo_members row...");
    const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/repo_members`, {
      method: 'POST',
      headers: { ...restHeaders(tokenA), Prefer: 'return=representation' },
      body: JSON.stringify({ repo_id: repoId, user_id: userA.id, role: 'owner' }),
    });
    assert(memberRes.ok, `owner repo_members row created (status ${memberRes.status})\n`);

    console.log("As user B, querying that repo by id — THE RLS GATE...");
    const readRes = await fetch(`${SUPABASE_URL}/rest/v1/repos?id=eq.${repoId}`, {
      headers: restHeaders(tokenB),
    });
    const readBody = await readRes.json();
    assert(
      readRes.ok && Array.isArray(readBody) && readBody.length === 0,
      `user B gets ZERO rows for A's repo (got ${Array.isArray(readBody) ? readBody.length : 'error'})`
    );

    console.log("\nAs user B, attempting to insert a commit into A's repo...");
    const commitRes = await fetch(`${SUPABASE_URL}/rest/v1/commits`, {
      method: 'POST',
      headers: { ...restHeaders(tokenB), Prefer: 'return=representation' },
      body: JSON.stringify({
        repo_id: repoId,
        parent_id: null,
        short_sha: 'bbbbbbb',
        message: 'hostile commit from B',
        author_id: userB.id,
      }),
    });
    const commitBody = await commitRes.json().catch(() => null);
    const commitBlocked =
      !commitRes.ok || (Array.isArray(commitBody) && commitBody.length === 0);
    assert(commitBlocked, `user B is blocked from inserting a commit (status ${commitRes.status})`);

    console.log('\nAs user A, confirming the repo (and hostile commit, if any) is cleanable...');
  } finally {
    // Delete the repo (as A) before deleting the users — repos.owner_id has
    // no ON DELETE CASCADE per PLAN.md §4, so deleting a user with an
    // existing repo would otherwise fail on a foreign-key violation.
    if (repoId) {
      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/repos?id=eq.${repoId}`, {
        method: 'DELETE',
        headers: restHeaders(tokenA),
      });
      if (!delRes.ok) {
        console.error(`  ⚠ failed to delete test repo ${repoId}: ${delRes.status}`);
      }
    }
    console.log('\nDeleting both test users...');
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    console.log('  ✓ cleanup done');
  }

  console.log(`\n${failures === 0 ? '✓ PASS' : `✗ FAIL (${failures} assertion(s) failed)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ verify-phase0 crashed:', err.message);
  process.exit(1);
});
