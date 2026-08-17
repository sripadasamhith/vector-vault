import { describe, expect, it } from 'vitest';
import { resolveRef } from '../refs';

// A minimal fake of the slice of the Supabase query builder resolveRef()
// actually uses: .from(table).select(...).eq(...).eq(...).maybeSingle().
// Good enough to unit-test the precedence logic without a live database.
interface FakeTables {
  repos: { id: string; default_branch: string }[];
  branches: { repo_id: string; name: string; head_id: string | null }[];
  tags: { repo_id: string; name: string; commit_id: string | null }[];
  commits: {
    id: string;
    repo_id: string;
    parent_id: string | null;
    short_sha: string;
    message: string;
    author_id: string;
    created_at: string;
  }[];
}

function makeFakeClient(tables: FakeTables) {
  return {
    from(table: keyof FakeTables) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        async maybeSingle() {
          const rows = tables[table] as unknown as Record<string, unknown>[];
          const match = rows.find((row) =>
            Object.entries(filters).every(([k, v]) => row[k] === v)
          );
          return { data: match ?? null, error: null };
        },
      };
      return builder;
    },
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

const REPO_ID = 'repo-1';

function fixture() {
  return makeFakeClient({
    repos: [{ id: REPO_ID, default_branch: 'main' }],
    branches: [
      { repo_id: REPO_ID, name: 'main', head_id: 'commit-2' },
      { repo_id: REPO_ID, name: 'empty-branch', head_id: null },
    ],
    tags: [{ repo_id: REPO_ID, name: 'v1.0', commit_id: 'commit-1' }],
    commits: [
      {
        id: 'commit-1',
        repo_id: REPO_ID,
        parent_id: null,
        short_sha: 'aaa1111',
        message: 'initial',
        author_id: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'commit-2',
        repo_id: REPO_ID,
        parent_id: 'commit-1',
        short_sha: 'bbb2222',
        message: 'second',
        author_id: 'user-1',
        created_at: '2026-01-02T00:00:00Z',
      },
    ],
  });
}

describe('resolveRef — HEAD, branch, tag, short sha precedence (PLAN.md §7)', () => {
  it('HEAD resolves to the default branch head commit', async () => {
    const commit = await resolveRef(fixture(), REPO_ID, 'HEAD');
    expect(commit?.id).toBe('commit-2');
  });

  it('a branch name resolves to that branch head commit', async () => {
    const commit = await resolveRef(fixture(), REPO_ID, 'main');
    expect(commit?.id).toBe('commit-2');
  });

  it('a tag name resolves to the tagged commit', async () => {
    const commit = await resolveRef(fixture(), REPO_ID, 'v1.0');
    expect(commit?.id).toBe('commit-1');
  });

  it('a short sha resolves directly to that commit', async () => {
    const commit = await resolveRef(fixture(), REPO_ID, 'aaa1111');
    expect(commit?.id).toBe('commit-1');
  });

  it('an unknown ref returns null', async () => {
    const commit = await resolveRef(fixture(), REPO_ID, 'does-not-exist');
    expect(commit).toBeNull();
  });

  it('a branch with no commits yet returns null rather than throwing', async () => {
    const commit = await resolveRef(fixture(), REPO_ID, 'empty-branch');
    expect(commit).toBeNull();
  });
});
