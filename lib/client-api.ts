// The only place fetch() appears (ARCHITECTURE.md §2). Components and
// commands call these typed wrappers, never fetch() directly. Seeded here
// for T0.6's dashboard; grows as later tasks add routes.
import type { ApiResponse } from './api/envelope';
import type { Repo } from './domain/repos';

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
