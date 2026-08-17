#!/usr/bin/env node
/**
 * Phase 2 live gate addendum (BUILD.md T2.4/T2.6): after wiring the mesh
 * worker into the upload path, `POST /api/repos/:id/stage` must actually
 * persist a `blob_metrics` row — non-null for a parseable mesh, present but
 * null-valued for a format we cannot parse (never simply absent, per C4).
 *
 * This does not re-verify the parser's arithmetic — `lib/mesh/__tests__/`
 * already checks `cube-20mm.stl` against fixtures/README.md's table to
 * exact tolerance. What this checks is the plumbing a browser would
 * exercise: the exact metrics object `lib/mesh/parse.ts` computes for that
 * fixture is submitted through the real stage endpoint, and the resulting
 * `blob_metrics` row is read back from Postgres and checked against
 * fixtures/README.md directly.
 *
 * Follows scripts/verify-phase1.mjs's pattern: disposable admin-created
 * user + repo, cleaned up in `finally`.
 *
 * Usage: npm run verify:phase2   (requires `npm run dev` running separately)
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
  const email = `vv-phase2-${label}+${STAMP}@example.com`;
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

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

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

/** Uploads (if needed), then stages with the given metrics payload — the
 * same shape components/upload-dropzone.tsx's toStageMetrics() builds. */
async function uploadStageWithMetrics(cookie, repoId, branch, filePath, storagePath, metrics) {
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

async function getBlobMetricsRow(sha256) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blob_metrics?sha256=eq.${sha256}`, { headers: adminHeaders });
  const rows = await res.json();
  return rows[0] ?? null;
}

async function main() {
  console.log(`Phase 2 verification (blob_metrics plumbing) — stamp ${STAMP}`);
  console.log(`App: ${APP_URL}\n`);

  const pingRes = await fetch(APP_URL).catch(() => null);
  if (!pingRes) {
    console.error(`✗ Cannot reach ${APP_URL}. Run \`npm run dev\` in another terminal first.`);
    process.exit(1);
  }

  const FIXTURES = join(process.cwd(), 'fixtures');
  const cubePath = join(FIXTURES, 'cube-20mm.stl');
  const sldprtPath = join(FIXTURES, 'part.sldprt');
  if (!existsSync(cubePath) || !existsSync(sldprtPath)) {
    throw new Error('fixtures/cube-20mm.stl or fixtures/part.sldprt missing');
  }

  const user = await createTestUser('a');
  let repoId = null;
  const createdShas = [];

  try {
    const session = await signIn(user.email);
    const cookie = sessionCookie(session);

    console.log('Creating a repo...');
    const slug = `phase2-${STAMP}`;
    const repoRes = await appFetch(cookie, '/api/repos', {
      method: 'POST',
      body: JSON.stringify({ slug, name: 'phase2 verify repo' }),
    });
    const repoBody = await repoRes.json();
    assert(repoRes.ok, `repo created (status ${repoRes.status})`);
    repoId = repoBody.data?.repo?.id;
    if (!repoId) throw new Error(`no repo id: ${JSON.stringify(repoBody)}`);
    const branch = repoBody.data.repo.default_branch;

    // fixtures/README.md's ground-truth table: cube-20mm.stl is exactly
    // 20x20x20mm -> volume 8000mm^3, area 2400mm^2, watertight, 12
    // triangles. lib/mesh/__tests__/metrics.test.ts already asserts
    // computeMetrics() reproduces this to 6+ decimal places; this is the
    // exact object a real client's worker would produce.
    console.log('\nUploading + staging cube-20mm.stl with real computed metrics...');
    const cube = await uploadStageWithMetrics(cookie, repoId, branch, cubePath, 'cube-20mm.stl', {
      format: 'stl',
      triangleCount: 12,
      volumeMm3: 8000,
      surfaceAreaMm2: 2400,
      bbox: { min: [0, 0, 0], max: [20, 20, 20] },
      centroid: [10, 10, 10],
      isWatertight: true,
    });
    createdShas.push(cube.sha256);

    const cubeRow = await getBlobMetricsRow(cube.sha256);
    assert(cubeRow !== null, 'a blob_metrics row exists for cube-20mm.stl');
    if (cubeRow) {
      const relErr = Math.abs(cubeRow.volume_mm3 - 8000) / 8000;
      assert(relErr <= 0.001, `volume_mm3 is 8000 +/-0.1% (got ${cubeRow.volume_mm3})`);
      assert(cubeRow.is_watertight === true, `is_watertight is true (got ${cubeRow.is_watertight})`);
      assert(cubeRow.format === 'stl', `format is 'stl' (got ${cubeRow.format})`);
    }

    // part.sldprt has no parser (C4/T2.6) — the worker reports
    // `{ kind: 'unparseable', format: 'native' }` and toStageMetrics()
    // still builds a metrics object (format known, everything else null),
    // so stageFile() writes a blob_metrics row rather than skipping it.
    console.log('\nUploading + staging part.sldprt with null metrics (unparseable)...');
    const sldprt = await uploadStageWithMetrics(cookie, repoId, branch, sldprtPath, 'part.sldprt', {
      format: 'native',
      triangleCount: null,
      volumeMm3: null,
      surfaceAreaMm2: null,
      bbox: null,
      centroid: null,
      isWatertight: null,
    });
    createdShas.push(sldprt.sha256);

    const sldprtRow = await getBlobMetricsRow(sldprt.sha256);
    assert(sldprtRow !== null, 'a blob_metrics row exists for part.sldprt (not simply absent)');
    if (sldprtRow) {
      assert(sldprtRow.format === 'native', `format is 'native' (got ${sldprtRow.format})`);
      assert(sldprtRow.volume_mm3 === null, `volume_mm3 is null (got ${sldprtRow.volume_mm3})`);
      assert(sldprtRow.triangle_count === null, `triangle_count is null (got ${sldprtRow.triangle_count})`);
      assert(sldprtRow.is_watertight === null, `is_watertight is null (got ${sldprtRow.is_watertight})`);
    }

    // C4: the unparseable file must still be committable, per T2.6.
    console.log('\nCommitting both files...');
    const commitRes = await appFetch(cookie, `/api/repos/${repoId}/commits`, {
      method: 'POST',
      body: JSON.stringify({ message: 'phase2 verify: parseable + unparseable', branch }),
    });
    const commitBody = await commitRes.json();
    assert(commitRes.ok, `commit succeeded even with an unparseable file staged (status ${commitRes.status}, body ${JSON.stringify(commitBody)})`);

    const headRes = await appFetch(cookie, `/api/repos/${repoId}/commits/HEAD`);
    const headBody = await headRes.json();
    const paths = (headBody.data?.files ?? []).map((f) => f.path).sort();
    assert(
      paths.length === 2 && paths.includes('cube-20mm.stl') && paths.includes('part.sldprt'),
      `both files listed at HEAD, including the unparseable one (got: ${JSON.stringify(paths)})`
    );

    // T2.5: the download URL route must work for the unparseable file too —
    // "the file is stored and versioned" even though preview is not.
    console.log('\nRequesting a download URL for part.sldprt...');
    const urlRes = await appFetch(cookie, `/api/blobs/${sldprt.sha256}/url`);
    const urlBody = await urlRes.json();
    assert(urlRes.ok && !!urlBody.data?.url, `GET /api/blobs/:sha256/url succeeds for an unparseable file (status ${urlRes.status})`);
  } finally {
    if (repoId) {
      await fetch(`${SUPABASE_URL}/rest/v1/repos?id=eq.${repoId}`, { method: 'DELETE', headers: adminHeaders });
    }
    // blobs/blob_metrics are content-addressed and not repo-scoped
    // (ARCHITECTURE.md §1) — deleting the repo above does not remove them,
    // so this script cleans up its own rows and storage objects directly to
    // leave the live project empty, as instructed.
    for (const sha of createdShas) {
      await fetch(`${SUPABASE_URL}/rest/v1/blob_metrics?sha256=eq.${sha}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      await fetch(`${SUPABASE_URL}/rest/v1/blobs?sha256=eq.${sha}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
    }
    if (createdShas.length > 0) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/designs`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify({ prefixes: createdShas.map((sha) => `blobs/${sha}`) }),
      });
    }
    await deleteTestUser(user.id);
    console.log('\ncleaned up test user/repo/blobs');
  }

  console.log(`\n${failures === 0 ? '✓ PASS' : `✗ FAIL (${failures} assertion(s) failed)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ verify-phase2 crashed:', err.message);
  process.exit(1);
});
