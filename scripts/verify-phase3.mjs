#!/usr/bin/env node
/**
 * Phase 3 gate (BUILD.md T3.4) — the C6 test. Exercises the real
 * `GET /api/repos/:id/diff` endpoint against real fixture bytes, end to
 * end, and asserts the six-way classification table (PLAN.md §5) comes back
 * right for every case BUILD.md names:
 *
 *   - cube-20mm.stl -> cube-20mm-refined.stl (same path, re-tessellated)
 *     must classify `reexported`, NOT `modified`. This is the point of the
 *     whole phase.
 *   - bracket-v1.stl -> bracket-v2.stl (same path, a real geometry change)
 *     must classify `modified`, with a populated, significant volume delta
 *     (38400 -> 32000 mm^3).
 *   - a path present only in the later commit classifies `added`.
 *   - a path present only in the earlier commit classifies `removed`.
 *   - a path whose bytes differ between two unparseable formats
 *     (part.sldprt -> part.step) classifies `binary`.
 *
 * Two commits are built so a single `diff(commitA, commitB)` call covers
 * all five cases in one request, then the response is asserted against
 * fixtures/README.md's ground-truth table directly (same pattern as
 * scripts/verify-phase2.mjs's blob_metrics check) — not against whatever
 * the app computed for itself, so a bug in the diff path can't grade its
 * own homework.
 *
 * Cleans up the repo, blobs, blob_metrics, storage objects, and the test
 * user in `finally` — the live project must be left empty.
 *
 * Usage: npm run verify:phase3   (requires `npm run dev` running separately,
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
  const email = `vv-phase3-${label}+${STAMP}@example.com`;
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
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(init.headers ?? {}) },
  });
}

/** Uploads (if needed) then stages `filePath`'s bytes at `storagePath`, with
 * a real fixtures/README.md-accurate metrics payload — the same shape
 * components/upload-dropzone.tsx's toStageMetrics() builds from a real
 * worker parse. */
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

async function stageRemoval(cookie, repoId, branch, path) {
  const res = await appFetch(cookie, `/api/repos/${repoId}/stage`, {
    method: 'DELETE',
    body: JSON.stringify({ path, branch }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`stage removal failed for ${path}: ${res.status} ${JSON.stringify(body)}`);
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

// fixtures/README.md's ground-truth table, reproduced as the exact metrics
// object a real client's worker would submit.
const CUBE_METRICS = {
  format: 'stl',
  triangleCount: 12,
  volumeMm3: 8000,
  surfaceAreaMm2: 2400,
  bbox: { min: [0, 0, 0], max: [20, 20, 20] },
  centroid: [10, 10, 10],
  isWatertight: true,
};
const CUBE_REFINED_METRICS = {
  ...CUBE_METRICS,
  triangleCount: 192,
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
const BRACKET_V2_METRICS = {
  format: 'stl',
  triangleCount: 12,
  volumeMm3: 32000,
  surfaceAreaMm2: 8800,
  bbox: { min: [0, 0, 0], max: [80, 40, 10] },
  centroid: [40, 20, 5],
  isWatertight: true,
};
const SLDPRT_METRICS = {
  format: 'native',
  triangleCount: null,
  volumeMm3: null,
  surfaceAreaMm2: null,
  bbox: null,
  centroid: null,
  isWatertight: null,
};
const STEP_METRICS = { ...SLDPRT_METRICS, format: 'step' };

async function main() {
  console.log(`Phase 3 verification (diff / C6 gate) — stamp ${STAMP}`);
  console.log(`App: ${APP_URL}\n`);

  const pingRes = await fetch(APP_URL).catch(() => null);
  if (!pingRes) {
    console.error(`✗ Cannot reach ${APP_URL}. Run \`npm run dev\` in another terminal first.`);
    process.exit(1);
  }

  const FIXTURES = join(process.cwd(), 'fixtures');
  const paths = {
    cube: join(FIXTURES, 'cube-20mm.stl'),
    refined: join(FIXTURES, 'cube-20mm-refined.stl'),
    bracketV1: join(FIXTURES, 'bracket-v1.stl'),
    bracketV2: join(FIXTURES, 'bracket-v2.stl'),
    sldprt: join(FIXTURES, 'part.sldprt'),
    step: join(FIXTURES, 'part.step'),
  };
  for (const [name, p] of Object.entries(paths)) {
    if (!existsSync(p)) throw new Error(`fixtures/${name} missing at ${p}`);
  }

  const user = await createTestUser('a');
  let repoId = null;
  const createdShas = new Set();

  try {
    const session = await signIn(user.email);
    const cookie = sessionCookie(session);

    console.log('Creating a repo...');
    const slug = `phase3-${STAMP}`;
    const repoRes = await appFetch(cookie, '/api/repos', {
      method: 'POST',
      body: JSON.stringify({ slug, name: 'phase3 verify repo' }),
    });
    const repoBody = await repoRes.json();
    assert(repoRes.ok, `repo created (status ${repoRes.status})`);
    repoId = repoBody.data?.repo?.id;
    if (!repoId) throw new Error(`no repo id: ${JSON.stringify(repoBody)}`);
    const branch = repoBody.data.repo.default_branch;

    console.log('\nCommit A: reexport.stl=cube, bracket.stl=v1, removed.stl=cube, unparseable.file=sldprt...');
    const a1 = await uploadAndStage(cookie, repoId, branch, paths.cube, 'reexport.stl', CUBE_METRICS);
    const a2 = await uploadAndStage(cookie, repoId, branch, paths.bracketV1, 'bracket.stl', BRACKET_V1_METRICS);
    const a3 = await uploadAndStage(cookie, repoId, branch, paths.cube, 'removed.stl', CUBE_METRICS);
    const a4 = await uploadAndStage(cookie, repoId, branch, paths.sldprt, 'unparseable.file', SLDPRT_METRICS);
    [a1, a2, a3, a4].forEach((r) => createdShas.add(r.sha256));
    const commitA = await commit(cookie, repoId, branch, 'commit A: baseline');
    assert(!!commitA.shortSha, `commit A created (${commitA.shortSha})`);

    console.log(
      '\nCommit B: reexport.stl=cube-refined, bracket.stl=v2, added.stl=cube, unparseable.file=step, removed.stl deleted...'
    );
    const b1 = await uploadAndStage(cookie, repoId, branch, paths.refined, 'reexport.stl', CUBE_REFINED_METRICS);
    const b2 = await uploadAndStage(cookie, repoId, branch, paths.bracketV2, 'bracket.stl', BRACKET_V2_METRICS);
    const b3 = await uploadAndStage(cookie, repoId, branch, paths.cube, 'added.stl', CUBE_METRICS);
    const b4 = await uploadAndStage(cookie, repoId, branch, paths.step, 'unparseable.file', STEP_METRICS);
    await stageRemoval(cookie, repoId, branch, 'removed.stl');
    [b1, b2, b3, b4].forEach((r) => createdShas.add(r.sha256));
    const commitB = await commit(cookie, repoId, branch, 'commit B: the five-way change');
    assert(!!commitB.shortSha, `commit B created (${commitB.shortSha})`);

    console.log(`\nGET /api/repos/${repoId}/diff?a=${commitA.shortSha}&b=${commitB.shortSha} ...`);
    const diffRes = await appFetch(cookie, `/api/repos/${repoId}/diff?a=${commitA.shortSha}&b=${commitB.shortSha}`);
    const diffBody = await diffRes.json();
    assert(diffRes.ok, `diff request succeeded (status ${diffRes.status}, body ${JSON.stringify(diffBody)})`);

    const changes = diffBody.data?.diff?.changes ?? [];
    const byPath = Object.fromEntries(changes.map((c) => [c.path, c]));

    console.log('\n--- The C6 case: cube-20mm.stl -> cube-20mm-refined.stl ---');
    const reexport = byPath['reexport.stl'];
    assert(!!reexport, 'reexport.stl appears in the diff');
    if (reexport) {
      assert(
        reexport.kind === 'reexported',
        `reexport.stl classifies as "reexported", NOT "modified" (got "${reexport.kind}")`
      );
    }

    console.log('\n--- bracket-v1.stl -> bracket-v2.stl: a real change ---');
    const bracket = byPath['bracket.stl'];
    assert(!!bracket, 'bracket.stl appears in the diff');
    if (bracket) {
      assert(bracket.kind === 'modified', `bracket.stl classifies as "modified" (got "${bracket.kind}")`);
      const volumeDelta = (bracket.deltas ?? []).find((d) => d.label === 'volume');
      assert(!!volumeDelta, 'bracket.stl has a "volume" delta row');
      if (volumeDelta) {
        assert(volumeDelta.a === '38.40 cm³', `volume.a is "38.40 cm³" (got "${volumeDelta.a}")`);
        assert(volumeDelta.b === '32.00 cm³', `volume.b is "32.00 cm³" (got "${volumeDelta.b}")`);
        assert(volumeDelta.significant === true, `volume delta is significant (got ${volumeDelta.significant})`);
      }
    }

    console.log('\n--- added / removed / binary ---');
    assert(byPath['added.stl']?.kind === 'added', `added.stl classifies as "added" (got "${byPath['added.stl']?.kind}")`);
    assert(
      byPath['removed.stl']?.kind === 'removed',
      `removed.stl classifies as "removed" (got "${byPath['removed.stl']?.kind}")`
    );
    assert(
      byPath['unparseable.file']?.kind === 'binary',
      `unparseable.file (sldprt -> step) classifies as "binary" (got "${byPath['unparseable.file']?.kind}")`
    );
  } finally {
    if (repoId) {
      await fetch(`${SUPABASE_URL}/rest/v1/repos?id=eq.${repoId}`, { method: 'DELETE', headers: adminHeaders });
    }
    // blobs/blob_metrics are content-addressed, not repo-scoped
    // (ARCHITECTURE.md §1) — deleting the repo above doesn't remove them,
    // so this script cleans up its own rows and storage objects directly to
    // leave the live project empty, as instructed.
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
    console.log('\ncleaned up test user/repo/blobs');
  }

  console.log(`\n${failures === 0 ? '✓ PASS' : `✗ FAIL (${failures} assertion(s) failed)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ verify-phase3 crashed:', err.message);
  process.exit(1);
});
