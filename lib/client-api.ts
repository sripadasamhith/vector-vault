// The only place fetch() appears (ARCHITECTURE.md §2). Components and
// commands call these typed wrappers, never fetch() directly. Seeded here
// for T0.6's dashboard; grows as later tasks add routes.
import type { ApiResponse } from './api/envelope';
import type { Repo } from './domain/repos';
import type { Commit } from './domain/commits';

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
    size: number;
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
