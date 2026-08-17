#!/usr/bin/env node
/**
 * Phase 4 gate (BUILD.md T4.1-T4.4) — branches, tags, revert, merge (C5),
 * and share links (ARCHITECTURE.md §6), exercised end to end against the
 * real API and a real Supabase project. Follows scripts/verify-phase3.mjs's
 * pattern: disposable admin-created user + repo, real fixture bytes through
 * the real endpoints, cleaned up in `finally`.
 *
 * Covers:
 *   - branch -> commit on it -> checkout main (GET at each ref) -> file
 *     sets differ
 *   - fast-forward merge succeeds (no divergence): main is an ancestor of
 *     feature-a, merging feature-a into main just moves main's pointer
 *   - diverged merge refuses: feature-b and main both changed part.stl
 *     differently from their common ancestor -> POST /merge returns
 *     cannot_merge naming part.stl, and main's commit count is unchanged
 *     (no commit created)
 *   - revert produces a NEW commit at the top of the log, with the
 *     reverted-to ref's exact file set
 *   - a share link opens with a plain unauthenticated fetch (no cookie at
 *     all) and returns exactly the pinned ref's files - nothing else
 *   - the share response is asserted to contain none of: other branch
 *     names, member/owner ids, repo settings fields
 *   - an expired token 404s (expiry forced via a direct admin PATCH to
 *     share_links.expires_at, so the test doesn't need to sleep)
 *
 * Usage: npm run verify:phase4   (requires `npm run dev` running separately,
 * or VV_APP_URL pointed at a deployment)
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
  const email = `vv-phase4-${label}+${STAMP}@example.com`;
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
  return body;
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
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(init.headers ?? {}) },
  });
}

async function uploadAndStage(cookie, repoId, branch, filePath, storagePath, metrics) {
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
    body: JSON.stringify({ path: storagePath, sha256, size: buf.length, branch, metrics }),
  });
  const stageBody = await stageRes.json();
  if (!stageRes.ok) throw new Error(`stage failed for ${storagePath}: ${stageRes.status} ${JSON.stringify(stageBody)}`);

  return { sha256 };
}

async function commit(cookie, repoId, branch, message) {
  const res = await appFetch(cookie, `/api/repos/${repoId}/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, branch }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`commit "${message}" failed: ${res.status} ${JSON.stringify(body)}`);
  return body.data; // { commitId, shortSha, branch }
}

async function getCommitAt(cookie, repoId, ref) {
  const res = await appFetch(cookie, `/api/repos/${repoId}/commits/${encodeURIComponent(ref)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`GET commit ${ref} failed: ${res.status} ${JSON.stringify(body)}`);
  return body.data; // { commit, files }
}

async function listCommits(cookie, repoId, branch) {
  const res = await appFetch(cookie, `/api/repos/${repoId}/commits?branch=${encodeURIComponent(branch)}&limit=50`);
  const body = await res.json();
  if (!res.ok) throw new Error(`GET log ${branch} failed: ${res.status} ${JSON.stringify(body)}`);
  return body.data.commits;
}

const CUBE_METRICS = {
  format: 'stl',
  triangleCount: 12,
  volumeMm3: 8000,
  surfaceAreaMm2: 2400,
  bbox: { min: [0, 0, 0], max: [20, 20, 20] },
  centroid: [10, 10, 10],
  isWatertight: true,
};
const BRACKET_V1_METRICS = {
  format: 'stl',
  triangleCount: 12,
  volumeMm3: 38400,
  surfaceAreaMm2: 9280,
  bbox: { min: [0, 0, 0], max: [80, 40, 12] },
  centroid: [40, 20, 6],
  isWatertight: true,
};
const OPEN_SHELL_METRICS = {
  format: 'stl',
  triangleCount: 10,
  volumeMm3: null,
  surfaceAreaMm2: 2000,
  bbox: { min: [0, 0, 0], max: [20, 20, 20] },
  centroid: [10, 10, 10],
  isWatertight: false,
};

async function main() {
  console.log(`Phase 4 verification (branches/tags/revert/merge/shares) — stamp ${STAMP}`);
  console.log(`App: ${APP_URL}\n`);

  const pingRes = await fetch(APP_URL).catch(() => null);
  if (!pingRes) {
    console.error(`✗ Cannot reach ${APP_URL}. Run \`npm run dev\` in another terminal first.`);
    process.exit(1);
  }

  const FIXTURES = join(process.cwd(), 'fixtures');
  const paths = {
    cube: join(FIXTURES, 'cube-20mm.stl'),
    bracketV1: join(FIXTURES, 'bracket-v1.stl'),
    openShell: join(FIXTURES, 'open-shell.stl'),
  };
  for (const [name, p] of Object.entries(paths)) {
    if (!existsSync(p)) throw new Error(`fixtures/${name} missing at ${p}`);
  }

  const user = await createTestUser('a');
  let repoId = null;
  const createdShas = new Set();
  const tokensToExpireCheck = [];

  try {
    const session = await signIn(user.email);
    const cookie = sessionCookie(session);

    console.log('Creating a repo...');
    const slug = `phase4-${STAMP}`;
    const repoRes = await appFetch(cookie, '/api/repos', {
      method: 'POST',
      body: JSON.stringify({ slug, name: 'phase4 verify repo' }),
    });
    const repoBody = await repoRes.json();
    assert(repoRes.ok, `repo created (status ${repoRes.status})`);
    repoId = repoBody.data?.repo?.id;
    if (!repoId) throw new Error(`no repo id: ${JSON.stringify(repoBody)}`);
    const mainBranch = repoBody.data.repo.default_branch;

    // --- C1: root commit on main -------------------------------------
    console.log('\nC1: part.stl = cube, on main...');
    const c1files = await uploadAndStage(cookie, repoId, mainBranch, paths.cube, 'part.stl', CUBE_METRICS);
    createdShas.add(c1files.sha256);
    const c1 = await commit(cookie, repoId, mainBranch, 'initial');
    assert(!!c1.shortSha, `C1 created (${c1.shortSha})`);

    // --- T4.1: branch, commit on it, confirm file sets differ --------
    console.log('\nT4.1: branch "feature-a" at C1, commit on it (bracket.stl content + a new path)...');
    const branchRes = await appFetch(cookie, `/api/repos/${repoId}/branches`, {
      method: 'POST',
      body: JSON.stringify({ name: 'feature-a', from: c1.shortSha }),
    });
    const branchBody = await branchRes.json();
    assert(branchRes.ok, `branch "feature-a" created (status ${branchRes.status})`);

    const a1 = await uploadAndStage(cookie, repoId, 'feature-a', paths.bracketV1, 'part.stl', BRACKET_V1_METRICS);
    const a2 = await uploadAndStage(cookie, repoId, 'feature-a', paths.cube, 'extra.stl', CUBE_METRICS);
    createdShas.add(a1.sha256);
    createdShas.add(a2.sha256);
    const c2 = await commit(cookie, repoId, 'feature-a', 'feature-a: replace part, add extra');
    assert(!!c2.shortSha, `C2 created on feature-a (${c2.shortSha})`);

    const mainAtC1 = await getCommitAt(cookie, repoId, 'main');
    const featureAAtC2 = await getCommitAt(cookie, repoId, 'feature-a');
    const mainPaths = mainAtC1.files.map((f) => f.path).sort();
    const featurePaths = featureAAtC2.files.map((f) => f.path).sort();
    assert(
      JSON.stringify(mainPaths) !== JSON.stringify(featurePaths),
      `main's file set (${JSON.stringify(mainPaths)}) differs from feature-a's (${JSON.stringify(featurePaths)})`
    );

    // --- T4.3: fast-forward merge -------------------------------------
    console.log('\nT4.3: merge feature-a into main (main is an ancestor of feature-a -> fast-forward)...');
    const commitsBeforeFF = await listCommits(cookie, repoId, mainBranch);
    const ffRes = await appFetch(cookie, `/api/repos/${repoId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ source: 'feature-a', target: mainBranch }),
    });
    const ffBody = await ffRes.json();
    assert(ffRes.ok, `fast-forward merge request succeeded (status ${ffRes.status}, body ${JSON.stringify(ffBody)})`);
    assert(ffBody.data?.kind === 'fast-forward', `merge reports kind "fast-forward" (got "${ffBody.data?.kind}")`);

    const mainAfterFF = await getCommitAt(cookie, repoId, mainBranch);
    assert(
      mainAfterFF.commit.short_sha === c2.shortSha,
      `main's HEAD now equals feature-a's commit (${c2.shortSha}), got ${mainAfterFF.commit.short_sha}`
    );
    const commitsAfterFF = await listCommits(cookie, repoId, mainBranch);
    assert(
      commitsAfterFF.length === commitsBeforeFF.length + 1,
      `fast-forward advanced main's log by exactly one existing commit, no new commit minted (before ${commitsBeforeFF.length}, after ${commitsAfterFF.length})`
    );

    // --- T4.3: diverged merge refuses ---------------------------------
    console.log('\nT4.3: branch "feature-b" at C1, diverge part.stl differently -> merge must refuse...');
    const branchBRes = await appFetch(cookie, `/api/repos/${repoId}/branches`, {
      method: 'POST',
      body: JSON.stringify({ name: 'feature-b', from: c1.shortSha }),
    });
    assert(branchBRes.ok, `branch "feature-b" created at C1 (status ${branchBRes.status})`);

    const b1 = await uploadAndStage(cookie, repoId, 'feature-b', paths.openShell, 'part.stl', OPEN_SHELL_METRICS);
    createdShas.add(b1.sha256);
    const c3 = await commit(cookie, repoId, 'feature-b', 'feature-b: diverge part.stl');
    assert(!!c3.shortSha, `C3 created on feature-b (${c3.shortSha})`);

    const commitsBeforeDivergedMerge = await listCommits(cookie, repoId, mainBranch);
    const mergeRes = await appFetch(cookie, `/api/repos/${repoId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ source: 'feature-b', target: mainBranch }),
    });
    const mergeBody = await mergeRes.json();
    assert(mergeRes.status === 409, `diverged merge returns 409 (got ${mergeRes.status})`);
    assert(mergeBody.error?.code === 'cannot_merge', `error code is "cannot_merge" (got "${mergeBody.error?.code}")`);
    assert(
      typeof mergeBody.error?.message === 'string' && mergeBody.error.message.includes('part.stl diverged in both branches.'),
      `refusal names part.stl as diverged (message: ${JSON.stringify(mergeBody.error?.message)})`
    );
    assert(
      mergeBody.error?.message?.startsWith('vault: geometry cannot be merged automatically.'),
      'refusal starts with the exact PLAN.md §6 text'
    );
    assert(
      mergeBody.error?.message?.includes('vault checkout feature-b -- part.stl') &&
        mergeBody.error?.message?.includes(`vault checkout ${mainBranch} -- part.stl`),
      'refusal offers both "checkout <branch> -- <path>" resolutions'
    );

    const commitsAfterDivergedMerge = await listCommits(cookie, repoId, mainBranch);
    assert(
      commitsAfterDivergedMerge.length === commitsBeforeDivergedMerge.length,
      `no commit was created by the refused merge (before ${commitsBeforeDivergedMerge.length}, after ${commitsAfterDivergedMerge.length})`
    );

    // --- T4.2: revert --------------------------------------------------
    console.log(`\nT4.2: revert main to C1 (${c1.shortSha})...`);
    const commitsBeforeRevert = await listCommits(cookie, repoId, mainBranch);
    const revertRes = await appFetch(cookie, `/api/repos/${repoId}/revert`, {
      method: 'POST',
      body: JSON.stringify({ ref: c1.shortSha, branch: mainBranch }),
    });
    const revertBody = await revertRes.json();
    assert(revertRes.ok, `revert succeeded (status ${revertRes.status}, body ${JSON.stringify(revertBody)})`);
    const commitsAfterRevert = await listCommits(cookie, repoId, mainBranch);
    assert(
      commitsAfterRevert.length === commitsBeforeRevert.length + 1,
      `revert created exactly one NEW commit (before ${commitsBeforeRevert.length}, after ${commitsAfterRevert.length})`
    );
    assert(
      commitsAfterRevert[0]?.short_sha === revertBody.data?.shortSha,
      `the new commit is at the TOP of the log (got ${commitsAfterRevert[0]?.short_sha}, expected ${revertBody.data?.shortSha})`
    );
    assert(
      commitsAfterRevert[0]?.short_sha !== c1.shortSha,
      'the revert commit is a NEW commit, not the original C1 (history was not rewritten)'
    );
    const mainAfterRevert = await getCommitAt(cookie, repoId, mainBranch);
    const c1Data = await getCommitAt(cookie, repoId, c1.shortSha);
    const revertedPaths = mainAfterRevert.files.map((f) => f.path).sort();
    const c1Paths = c1Data.files.map((f) => f.path).sort();
    assert(
      JSON.stringify(revertedPaths) === JSON.stringify(c1Paths),
      `reverted file set (${JSON.stringify(revertedPaths)}) matches C1's (${JSON.stringify(c1Paths)})`
    );
    const revertedShas = mainAfterRevert.files.map((f) => f.sha256).sort();
    const c1Shas = c1Data.files.map((f) => f.sha256).sort();
    assert(
      JSON.stringify(revertedShas) === JSON.stringify(c1Shas),
      'reverted file blobs match C1\'s exactly (same sha256 per path)'
    );

    // --- T4.4: share link ------------------------------------------------
    console.log('\nT4.4: mint a share link for main, fetch it with NO auth cookie at all...');
    const shareRes = await appFetch(cookie, `/api/repos/${repoId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ ref: mainBranch }),
    });
    const shareBody = await shareRes.json();
    assert(shareRes.ok, `share minted (status ${shareRes.status}, body ${JSON.stringify(shareBody)})`);
    const token = shareBody.data?.token;
    assert(typeof token === 'string' && token.length > 0, `token is a non-empty string (${token})`);
    // 32 raw bytes, base64url, no padding -> 43 chars.
    assert(token.length === 43, `token is base64url(32 bytes) = 43 chars (got ${token.length})`);
    assert(!/[+/=]/.test(token), 'token uses the URL-safe alphabet (no +, /, or =)');

    const publicRes = await fetch(`${APP_URL}/api/shared/${token}`); // no Cookie header at all
    const publicText = await publicRes.text();
    let publicBody;
    try {
      publicBody = JSON.parse(publicText);
    } catch {
      throw new Error(`share response was not JSON: ${publicText.slice(0, 200)}`);
    }
    assert(publicRes.ok, `unauthenticated GET /api/shared/:token succeeded (status ${publicRes.status})`);
    assert(publicBody.data?.ref === mainBranch, `share pins ref "${mainBranch}" (got "${publicBody.data?.ref}")`);
    assert(
      publicBody.data?.shortSha === revertBody.data?.shortSha,
      `share resolves to main's current HEAD (${revertBody.data?.shortSha}), got ${publicBody.data?.shortSha}`
    );
    const sharedPaths = (publicBody.data?.files ?? []).map((f) => f.path).sort();
    assert(
      JSON.stringify(sharedPaths) === JSON.stringify(c1Paths),
      `share returns exactly the pinned ref's files (${JSON.stringify(sharedPaths)})`
    );
    assert(
      (publicBody.data?.files ?? []).every((f) => typeof f.downloadUrl === 'string' && f.downloadUrl.length > 0),
      'every shared file has a working (non-null) signed download URL'
    );

    console.log('\nT4.4: asserting the share response leaks nothing else...');
    const forbiddenStrings = [
      'feature-a',
      'feature-b',
      user.id, // owner/created_by id
      'repo_members',
      'owner_id',
      'default_branch',
      'visibility',
      '"private"',
    ];
    for (const needle of forbiddenStrings) {
      assert(!publicText.includes(needle), `share response body does not contain "${needle}"`);
    }
    const dataKeys = Object.keys(publicBody.data ?? {}).sort();
    assert(
      JSON.stringify(dataKeys) === JSON.stringify(['files', 'ref', 'shortSha']),
      `share response's top-level keys are exactly ref/shortSha/files (got ${JSON.stringify(dataKeys)})`
    );

    // --- T4.4: expired token 404s -----------------------------------
    console.log('\nT4.4: forcing a token to expire, confirming it 404s...');
    const expireRes = await appFetch(cookie, `/api/repos/${repoId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ ref: mainBranch, expiresInSeconds: 3600 }),
    });
    const expireBody = await expireRes.json();
    assert(expireRes.ok, `second share minted for the expiry test (status ${expireRes.status})`);
    const expiringToken = expireBody.data.token;
    tokensToExpireCheck.push(expiringToken);

    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/share_links?token=eq.${expiringToken}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ expires_at: pastIso }),
    });
    assert(patchRes.ok, `test harness forced expires_at into the past (status ${patchRes.status})`);

    const expiredRes = await fetch(`${APP_URL}/api/shared/${expiringToken}`);
    assert(expiredRes.status === 404, `expired token 404s (got ${expiredRes.status})`);

    const neverExistedRes = await fetch(`${APP_URL}/api/shared/${'a'.repeat(43)}`);
    assert(
      neverExistedRes.status === 404,
      `a token that never existed also 404s, same as expired (got ${neverExistedRes.status})`
    );
  } finally {
    if (repoId) {
      await fetch(`${SUPABASE_URL}/rest/v1/repos?id=eq.${repoId}`, { method: 'DELETE', headers: adminHeaders });
    }
    for (const sha of createdShas) {
      await fetch(`${SUPABASE_URL}/rest/v1/blob_metrics?sha256=eq.${sha}`, { method: 'DELETE', headers: adminHeaders });
      await fetch(`${SUPABASE_URL}/rest/v1/blobs?sha256=eq.${sha}`, { method: 'DELETE', headers: adminHeaders });
    }
    if (createdShas.size > 0) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/designs`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify({ prefixes: Array.from(createdShas).map((sha) => `blobs/${sha}`) }),
      });
    }
    await deleteTestUser(user.id);
    console.log('\ncleaned up test user/repo/blobs (repo delete cascades branches/tags/commits/share_links)');

    // BUILD.md: "the live project is currently empty and must be left that
    // way — verify it is empty at the end and say so."
    const [reposLeft, blobsLeft, usersLeft] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/repos?select=id`, { headers: adminHeaders }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/blobs?select=sha256`, { headers: adminHeaders }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, { headers: adminHeaders })
        .then((r) => r.json())
        .then((b) => b.users ?? []),
    ]);
    assert(Array.isArray(reposLeft) && reposLeft.length === 0, `project has zero repos left (got ${reposLeft.length ?? 'error'})`);
    assert(Array.isArray(blobsLeft) && blobsLeft.length === 0, `project has zero blobs left (got ${blobsLeft.length ?? 'error'})`);
    assert(Array.isArray(usersLeft) && usersLeft.length === 0, `project has zero users left (got ${usersLeft.length ?? 'error'})`);
  }

  console.log(`\n${failures === 0 ? '✓ PASS' : `✗ FAIL (${failures} assertion(s) failed)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ verify-phase4 crashed:', err.message);
  process.exit(1);
});
