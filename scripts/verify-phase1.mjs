#!/usr/bin/env node
/**
 * Phase 1 exit gate (BUILD.md): "a 40 MB file uploads; uploading it twice
 * creates one `blobs` row" plus T1.8's specific check: "upload two files,
 * commit, reload the page, both files listed at HEAD ... upload the same
 * file a second time -> still one row in `blobs`."
 *
 * Exercises the REAL upload path end to end against a running `next dev`
 * server (start one first: `npm run dev`) and the live Supabase project:
 * hash -> POST /api/uploads/sign -> PUT the signed URL directly to Storage
 * -> POST /api/repos/:id/stage -> POST /api/repos/:id/commits -> GET the
 * commit at HEAD and assert both files are present. Then repeats the first
 * file's upload and asserts `alreadyExists: true` plus exactly one `blobs`
 * row for its sha256.
 *
 * Follows scripts/verify-phase0.mjs's pattern: disposable admin-created
 * user, cleaned up in `finally`, no reliance on email confirmation.
 *
 * Usage: npm run verify:phase1   (requires `npm run dev` running separately)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const APP_URL = process.env.VV_APP_URL ?? 'http://localhost:3000';

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
      if (!(k in process.env)) env[k] = v;
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

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
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

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function createTestUser(label) {
  const email = `vv-phase1-${label}+${STAMP}@example.com`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`admin create user (${label}) failed: ${res.status} ${JSON.stringify(body)}`);
  return { id: body.id, email };
}

async function signIn(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${JSON.stringify(body)}`);
  return body; // full session, needed to build the ssr cookie
}

async function deleteTestUser(id) {
  if (!id) return;
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
}

function sessionCookie(session) {
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
  return `sb-${PROJECT_REF}-auth-token=${value}`;
}

async function appFetch(cookie, path, init = {}) {
  return fetch(`${APP_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(init.headers ?? {}) },
  });
}

async function uploadAndStage(cookie, repoId, branch, filePath, storagePath) {
  const buf = readFileSync(filePath);
  const sha256 = sha256Hex(buf);

  const signRes = await appFetch(cookie, '/api/uploads/sign', {
    method: 'POST',
    body: JSON.stringify({ sha256, filename: storagePath, size: buf.length }),
  });
  const signBody = await signRes.json();
  if (!signRes.ok) throw new Error(`sign failed for ${storagePath}: ${signRes.status} ${JSON.stringify(signBody)}`);

  if (!signBody.data.alreadyExists) {
    const putRes = await fetch(signBody.data.signedUrl, {
      method: 'PUT',
      headers: {
        apikey: ANON_KEY,
        'content-type': 'application/octet-stream',
        'x-upsert': 'false',
        'cache-control': 'max-age=3600',
      },
      body: buf,
    });
    if (!putRes.ok) {
      throw new Error(`storage PUT failed for ${storagePath}: ${putRes.status} ${await putRes.text()}`);
    }
  }

  const stageRes = await appFetch(cookie, `/api/repos/${repoId}/stage`, {
    method: 'POST',
    body: JSON.stringify({ path: storagePath, sha256, size: buf.length, branch }),
  });
  const stageBody = await stageRes.json();
  if (!stageRes.ok) throw new Error(`stage failed for ${storagePath}: ${stageRes.status} ${JSON.stringify(stageBody)}`);

  return { sha256, alreadyExists: !!signBody.data.alreadyExists };
}

async function main() {
  console.log(`Phase 1 verification — stamp ${STAMP}`);
  console.log(`App: ${APP_URL}\n`);

  const pingRes = await fetch(APP_URL).catch(() => null);
  if (!pingRes) {
    console.error(`✗ Cannot reach ${APP_URL}. Run \`npm run dev\` in another terminal first.`);
    process.exit(1);
  }

  const FIXTURES = join(process.cwd(), 'fixtures');
  const fileA = join(FIXTURES, 'cube-20mm.stl');
  const fileB = join(FIXTURES, 'bracket-v1.stl');

  const user = await createTestUser('a');
  let repoId = null;

  try {
    const session = await signIn(user.email);
    const cookie = sessionCookie(session);

    console.log('Creating a repo...');
    const slug = `phase1-${STAMP}`;
    const repoRes = await appFetch(cookie, '/api/repos', {
      method: 'POST',
      body: JSON.stringify({ slug, name: 'phase1 verify repo' }),
    });
    const repoBody = await repoRes.json();
    assert(repoRes.ok, `repo created (status ${repoRes.status})`);
    repoId = repoBody.data?.repo?.id;
    if (!repoId) throw new Error(`no repo id: ${JSON.stringify(repoBody)}`);
    const branch = repoBody.data.repo.default_branch;

    console.log('\nUploading + staging cube-20mm.stl...');
    const a = await uploadAndStage(cookie, repoId, branch, fileA, 'cube-20mm.stl');
    assert(!a.alreadyExists, 'first upload of cube-20mm.stl was a fresh blob');

    console.log('Uploading + staging bracket-v1.stl...');
    const b = await uploadAndStage(cookie, repoId, branch, fileB, 'bracket-v1.stl');
    assert(!b.alreadyExists, 'first upload of bracket-v1.stl was a fresh blob');

    console.log('\nCommitting...');
    const commitRes = await appFetch(cookie, `/api/repos/${repoId}/commits`, {
      method: 'POST',
      body: JSON.stringify({ message: 'phase1 verify: two files', branch }),
    });
    const commitBody = await commitRes.json();
    assert(commitRes.ok, `commit succeeded (status ${commitRes.status}, body ${JSON.stringify(commitBody)})`);

    console.log('\nReading HEAD (simulating a page reload)...');
    const headRes = await appFetch(cookie, `/api/repos/${repoId}/commits/HEAD`);
    const headBody = await headRes.json();
    assert(headRes.ok, `GET HEAD succeeded (status ${headRes.status})`);
    const paths = (headBody.data?.files ?? []).map((f) => f.path).sort();
    assert(
      paths.length === 2 && paths.includes('cube-20mm.stl') && paths.includes('bracket-v1.stl'),
      `both files listed at HEAD (got: ${JSON.stringify(paths)})`
    );

    console.log('\nUploading cube-20mm.stl a second time (dedup check)...');
    const aAgain = await uploadAndStage(cookie, repoId, branch, fileA, 'cube-20mm-again.stl');
    assert(aAgain.alreadyExists, 'second upload of the same bytes reports alreadyExists: true');

    const blobsRes = await fetch(`${SUPABASE_URL}/rest/v1/blobs?sha256=eq.${a.sha256}`, { headers: adminHeaders });
    const blobsRows = await blobsRes.json();
    assert(blobsRows.length === 1, `exactly one blobs row for cube-20mm.stl's sha256 (got ${blobsRows.length})`);

    console.log(`\nlog check: GET /api/repos/:id/commits`);
    const logRes = await appFetch(cookie, `/api/repos/${repoId}/commits`);
    const logBody = await logRes.json();
    assert(
      logRes.ok && logBody.data.commits.length === 1,
      `log shows exactly the one commit made (got ${logBody.data?.commits?.length})`
    );
  } finally {
    if (repoId) {
      await fetch(`${SUPABASE_URL}/rest/v1/repos?id=eq.${repoId}`, { method: 'DELETE', headers: adminHeaders });
    }
    await deleteTestUser(user.id);
    console.log('\ncleaned up test user/repo');
  }

  console.log(`\n${failures === 0 ? '✓ PASS' : `✗ FAIL (${failures} assertion(s) failed)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ verify-phase1 crashed:', err.message);
  process.exit(1);
});
