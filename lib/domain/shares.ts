// lib/domain/** owns query logic (ARCHITECTURE.md §2). T4.4 — share links
// (ARCHITECTURE.md §6). Two halves live in this one file because they're
// two different trust boundaries on the same table:
//
//   * mintShare() runs with the caller's RLS-scoped client (owner-only per
//     the share_links_insert policy in 0003_rls.sql) — an authenticated,
//     authorized user creating a link.
//   * resolveShare() is generic over SupabaseClient too, but in practice is
//     called ONLY from app/api/shared/[token]/route.ts with the
//     service-role admin client, because an anonymous link visitor has no
//     session and no RLS grant to read share_links, repos, or commit_files
//     at all (ARCHITECTURE.md §6 — "Do not implement sharing by adding a
//     permissive RLS policy"). This function does not itself decide which
//     client it gets; the route is the only file trusted to hand it the
//     admin one.
//
// resolveShare() returns ONLY the pinned ref's file list, metrics, and
// short-lived signed download URLs — never other branches, other refs, the
// member list, repo settings, or owner identity (ARCHITECTURE.md §6 step 3-4).
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRef } from './refs';
import { getCommitFiles } from './commits';

const BUCKET = 'designs';
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

export interface ShareLink {
  token: string;
  repo_id: string;
  ref: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export type MintShareResult = { ok: true; share: ShareLink } | { ok: false; message: string };

/** 32 raw bytes, base64url-encoded (BUILD.md T4.4) — ~43 characters, no
 * padding, URL-safe alphabet by construction. */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function mintShare(
  supabase: SupabaseClient,
  params: { repoId: string; ref?: string | null; expiresInSeconds?: number; createdBy: string }
): Promise<MintShareResult> {
  const token = generateToken();
  const expiresAt = params.expiresInSeconds
    ? new Date(Date.now() + params.expiresInSeconds * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('share_links')
    .insert({
      token,
      repo_id: params.repoId,
      ref: params.ref ?? null,
      expires_at: expiresAt,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) return { ok: false, message: error.message };
  return { ok: true, share: data as ShareLink };
}

export interface SharedFile {
  path: string;
  sha256: string;
  sizeBytes: number | null;
  downloadUrl: string | null;
  metrics: {
    format: string;
    triangleCount: number | null;
    volumeMm3: number | null;
    surfaceAreaMm2: number | null;
    bbox: { min: [number, number, number]; max: [number, number, number] } | null;
    centroid: [number, number, number] | null;
    isWatertight: boolean | null;
  } | null;
}

export interface ResolvedShare {
  ref: string;
  shortSha: string;
  files: SharedFile[];
}

export type ResolveShareResult =
  | { ok: true; share: ResolvedShare }
  | { ok: false; kind: 'not_found' | 'expired' };

/**
 * Looks up `token`, checks expiry, resolves the pinned ref (or the repo's
 * default branch if the link didn't pin one) to a commit, and returns
 * exactly that commit's file list — nothing else. `supabase` must be the
 * service-role admin client; a user-scoped client can't see share_links
 * rows by token at all (no such RLS policy exists, by design).
 */
export async function resolveShare(supabase: SupabaseClient, token: string): Promise<ResolveShareResult> {
  const { data: share, error } = await supabase
    .from('share_links')
    .select('token, repo_id, ref, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !share) return { ok: false, kind: 'not_found' };

  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return { ok: false, kind: 'expired' };
  }

  const { data: repo } = await supabase
    .from('repos')
    .select('id, default_branch')
    .eq('id', share.repo_id)
    .maybeSingle();
  if (!repo) return { ok: false, kind: 'not_found' };

  const ref = share.ref ?? repo.default_branch;
  const commit = await resolveRef(supabase, share.repo_id, ref);
  if (!commit) return { ok: false, kind: 'not_found' };

  const files = await getCommitFiles(supabase, commit.id);
  const shas = files.map((f) => f.sha256).filter((s): s is string => s !== null);

  const metricsBySha = new Map<string, SharedFile['metrics']>();
  if (shas.length > 0) {
    const { data: metricsRows } = await supabase.from('blob_metrics').select('*').in('sha256', shas);
    for (const row of metricsRows ?? []) {
      metricsBySha.set(row.sha256, {
        format: row.format,
        triangleCount: row.triangle_count,
        volumeMm3: row.volume_mm3,
        surfaceAreaMm2: row.surface_area_mm2,
        bbox: row.bbox,
        centroid: row.centroid,
        isWatertight: row.is_watertight,
      });
    }
  }

  const storagePathBySha = new Map<string, string>();
  if (shas.length > 0) {
    const { data: blobRows } = await supabase.from('blobs').select('sha256, storage_path').in('sha256', shas);
    for (const row of blobRows ?? []) {
      storagePathBySha.set(row.sha256, row.storage_path);
    }
  }

  const sharedFiles: SharedFile[] = [];
  for (const f of files) {
    if (!f.sha256) continue; // should not happen in a committed snapshot
    let downloadUrl: string | null = null;
    const storagePath = storagePathBySha.get(f.sha256);
    if (storagePath) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS);
      downloadUrl = signed?.signedUrl ?? null;
    }
    sharedFiles.push({
      path: f.path,
      sha256: f.sha256,
      sizeBytes: f.sizeBytes,
      downloadUrl,
      metrics: metricsBySha.get(f.sha256) ?? null,
    });
  }

  return {
    ok: true,
    share: { ref, shortSha: commit.short_sha, files: sharedFiles },
  };
}
