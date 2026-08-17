// The only place fetch() appears (ARCHITECTURE.md §2). Components and
// commands call these typed wrappers, never fetch() directly. Seeded here
// for T0.6's dashboard; grows as later tasks add routes.
import type { ApiResponse } from './api/envelope';
import type { Repo, Branch } from './domain/repos';
import type { Commit, CommitFile } from './domain/commits';
import type { DiffResult } from './domain/diff';
import type { TagWithShortSha } from './domain/tags';
import type { SharedFile } from './domain/shares';

async function request<T>(input: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  return (await res.json()) as ApiResponse<T>;
}

export function createRepo(params: { slug: string; name: string; description?: string }) {
  return request<{ repo: Repo }>('/api/repos', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function listRepos() {
  return request<{ repos: Repo[] }>('/api/repos');
}

export type SignUploadResponse =
  | { alreadyExists: true }
  | { alreadyExists: false; signedUrl: string; token: string; path: string };

export function signUpload(params: { sha256: string; filename: string; size: number }) {
  return request<SignUploadResponse>('/api/uploads/sign', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface StageMetricsInput {
  format: string;
  triangleCount: number | null;
  volumeMm3: number | null;
  surfaceAreaMm2: number | null;
  bbox: { min: [number, number, number]; max: [number, number, number] } | null;
  centroid: [number, number, number] | null;
  isWatertight: boolean | null;
}

export function stageFile(
  repoId: string,
  params: {
    path: string;
    sha256: string;
    size?: number;
    branch?: string;
    metrics?: StageMetricsInput | null;
  }
) {
  return request<{ staged: true; path: string; branch: string }>(`/api/repos/${repoId}/stage`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function stageRemoval(repoId: string, params: { path: string; branch?: string }) {
  return request<{ staged: true; path: string; branch: string; removal: true }>(
    `/api/repos/${repoId}/stage`,
    { method: 'DELETE', body: JSON.stringify(params) }
  );
}

export function commit(repoId: string, params: { message: string; branch?: string }) {
  return request<{ commitId: string; shortSha: string; branch: string }>(
    `/api/repos/${repoId}/commits`,
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export function listCommits(repoId: string, params?: { branch?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.branch) query.set('branch', params.branch);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request<{ commits: Commit[]; branch: string }>(
    `/api/repos/${repoId}/commits${qs ? `?${qs}` : ''}`
  );
}

/** One commit + its file snapshot at a ref (HEAD / branch / tag / short sha). */
export function getCommitAtRef(repoId: string, ref: string) {
  return request<{ commit: Commit; files: CommitFile[] }>(
    `/api/repos/${repoId}/commits/${encodeURIComponent(ref)}`
  );
}

export interface StagedFileRow {
  path: string;
  sha256: string | null;
  staged_at: string;
}

export function listStagedFiles(repoId: string, branch?: string) {
  const qs = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return request<{ staged: StagedFileRow[]; branch: string }>(`/api/repos/${repoId}/stage${qs}`);
}

/** T2.5 — a short-lived signed URL to download a content-addressed blob's
 * bytes directly from Storage. */
export function getBlobDownloadUrl(sha256: string) {
  return request<{ url: string }>(`/api/blobs/${encodeURIComponent(sha256)}/url`);
}

/** T3.2 — GET /api/repos/:id/diff?a=&b=. Both omitted: HEAD vs staged. One
 * given: that ref vs HEAD. Both given: those two refs (lib/domain/diff.ts's
 * defaults). */
export function diffRefs(repoId: string, params?: { a?: string; b?: string }) {
  const query = new URLSearchParams();
  if (params?.a) query.set('a', params.a);
  if (params?.b) query.set('b', params.b);
  const qs = query.toString();
  return request<{ diff: DiffResult }>(`/api/repos/${repoId}/diff${qs ? `?${qs}` : ''}`);
}

// T4.1 — branches.

export function listBranches(repoId: string) {
  return request<{ branches: Branch[] }>(`/api/repos/${repoId}/branches`);
}

export function createBranch(repoId: string, params: { name: string; from?: string }) {
  return request<{ branch: Branch }>(`/api/repos/${repoId}/branches`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// T4.2 — tags and revert.

export function listTags(repoId: string) {
  return request<{ tags: TagWithShortSha[] }>(`/api/repos/${repoId}/tags`);
}

export function createTag(repoId: string, params: { name: string; ref?: string; note?: string }) {
  return request<{ tag: TagWithShortSha }>(`/api/repos/${repoId}/tags`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function revertToRef(repoId: string, params: { ref: string; branch?: string; message?: string }) {
  return request<{ commitId: string; shortSha: string; branch: string }>(`/api/repos/${repoId}/revert`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// T4.3 — merge.

export type MergeResponse =
  | { kind: 'up-to-date'; branch: string }
  | { kind: 'fast-forward'; branch: string; shortSha: string };

export function mergeBranch(repoId: string, params: { source: string; target?: string }) {
  return request<MergeResponse>(`/api/repos/${repoId}/merge`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// T4.4 — share links.

export function createShare(repoId: string, params: { ref?: string; expiresInSeconds?: number }) {
  return request<{ token: string; ref: string | null; expiresAt: string | null; url: string }>(
    `/api/repos/${repoId}/shares`,
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export interface SharedPayload {
  ref: string;
  shortSha: string;
  files: SharedFile[];
}
