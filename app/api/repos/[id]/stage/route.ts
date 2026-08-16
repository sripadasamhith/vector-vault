// T1.4 (BUILD.md) / ARCHITECTURE.md §4 step 4. Writer-only: staging changes
// requires at least `writer` role. Parses/validates and delegates to
// lib/domain/staging.ts — no query logic here per the layering rule.
import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireRepoRole } from '@/lib/api/guard';
import { stageFile, stageRemoval } from '@/lib/domain/staging';
import { getDefaultBranch } from '@/lib/domain/repos';

const SHA256_RE = /^[0-9a-f]{64}$/;
const KNOWN_FORMATS = ['stl', 'obj', '3mf', 'step', 'iges', 'native', 'unknown'] as const;

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

// Client-computed metrics are untrusted input (ARCHITECTURE.md §9) — range
// checked here: finite numbers, non-negative where physically meaningful,
// sane triangle count.
const metricsSchema = z.object({
  format: z.enum(KNOWN_FORMATS),
  triangleCount: z.number().int().nonnegative().nullable(),
  volumeMm3: z.number().finite().nonnegative().nullable(),
  surfaceAreaMm2: z.number().finite().nonnegative().nullable(),
  bbox: z.object({ min: vec3, max: vec3 }).nullable(),
  centroid: vec3.nullable(),
  isWatertight: z.boolean().nullable(),
});

const stageSchema = z.object({
  path: z.string().min(1).max(4096),
  sha256: z.string().regex(SHA256_RE, 'sha256 must be 64 lowercase hex characters'),
  size: z.number().int().positive(),
  branch: z.string().min(1).max(255).optional(),
  metrics: metricsSchema.optional().nullable(),
});

const unstageSchema = z.object({
  path: z.string().min(1).max(4096),
  branch: z.string().min(1).max(255).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'writer');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = stageSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const branch = parsed.data.branch ?? (await getDefaultBranch(auth.supabase, repoId));

  const result = await stageFile(auth.supabase, {
    repoId,
    userId: auth.user.id,
    branch,
    path: parsed.data.path,
    sha256: parsed.data.sha256,
    size: parsed.data.size,
    metrics: parsed.data.metrics ?? null,
  });

  if (!result.ok) {
    return fail('invalid_input', result.message);
  }

  return ok({ staged: true, path: parsed.data.path, branch });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: repoId } = await params;
  const auth = await requireRepoRole(repoId, 'writer');
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = unstageSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const branch = parsed.data.branch ?? (await getDefaultBranch(auth.supabase, repoId));

  const result = await stageRemoval(auth.supabase, {
    repoId,
    userId: auth.user.id,
    branch,
    path: parsed.data.path,
  });

  if (!result.ok) {
    return fail('invalid_input', result.message);
  }

  return ok({ staged: true, path: parsed.data.path, branch, removal: true });
}
