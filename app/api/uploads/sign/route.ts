// T1.2 (BUILD.md) / ARCHITECTURE.md §4 step 2. Input is a hash the browser
// already computed client-side — never a file body (that would violate the
// upload flow: files must never pass through a Next.js route). Delegates
// all query/storage logic to lib/domain/uploads.ts per the layering rule.
import { z } from 'zod';
import { ok, fail } from '@/lib/api/envelope';
import { requireUser } from '@/lib/api/guard';
import { signUpload, MAX_UPLOAD_BYTES } from '@/lib/domain/uploads';

const SHA256_RE = /^[0-9a-f]{64}$/;

const signSchema = z.object({
  sha256: z.string().regex(SHA256_RE, 'sha256 must be 64 lowercase hex characters'),
  filename: z.string().min(1).max(1024),
  size: z.number().int().positive(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = signSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  if (parsed.data.size > MAX_UPLOAD_BYTES) {
    return fail(
      'invalid_input',
      `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MiB per-object limit.`
    );
  }

  const result = await signUpload(auth.supabase, parsed.data);

  if (result.kind === 'error') {
    return fail('invalid_input', result.message);
  }
  if (result.kind === 'already_exists') {
    return ok({ alreadyExists: true as const });
  }

  return ok({
    alreadyExists: false as const,
    signedUrl: result.signedUrl,
    token: result.token,
    path: result.path,
  });
}
