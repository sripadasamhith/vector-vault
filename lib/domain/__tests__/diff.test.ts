import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { classifyChange, type FileSide } from '../diff';
import { parseSTL } from '../../mesh/parse';
import { computeMetrics } from '../../mesh/metrics';
import type { MeshMetrics } from '../../mesh/types';

const FIXTURES = path.resolve(__dirname, '../../../fixtures');

function loadFixture(name: string): ArrayBuffer {
  const buf = readFileSync(path.join(FIXTURES, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function metricsFor(name: string): MeshMetrics {
  return computeMetrics(parseSTL(loadFixture(name)), 'stl');
}

function side(sha256: string, metrics: MeshMetrics | null): FileSide {
  return { sha256, metrics };
}

describe('classifyChange — the six-way table (PLAN.md §5)', () => {
  it('unchanged: same sha256', () => {
    const m = metricsFor('cube-20mm.stl');
    expect(classifyChange(side('abc123', m), side('abc123', m))).toBe('unchanged');
  });

  it('reexported: the C6 anchor — cube-20mm.stl vs cube-20mm-refined.stl', () => {
    const a = side('sha-cube', metricsFor('cube-20mm.stl'));
    const b = side('sha-refined', metricsFor('cube-20mm-refined.stl'));
    expect(a.sha256).not.toBe(b.sha256);
    expect(classifyChange(a, b)).toBe('reexported');
  });

  it('modified: bracket-v1.stl vs bracket-v2.stl (a real geometry change)', () => {
    const a = side('sha-v1', metricsFor('bracket-v1.stl'));
    const b = side('sha-v2', metricsFor('bracket-v2.stl'));
    expect(classifyChange(a, b)).toBe('modified');
  });

  it('added: present in B only', () => {
    const b = side('sha-new', metricsFor('cube-20mm.stl'));
    expect(classifyChange(null, b)).toBe('added');
  });

  it('removed: present in A only', () => {
    const a = side('sha-old', metricsFor('cube-20mm.stl'));
    expect(classifyChange(a, null)).toBe('removed');
  });

  it('binary: sha differs and metrics are unavailable on at least one side', () => {
    const a = side('sha-a', null);
    const b = side('sha-b', null);
    expect(classifyChange(a, b)).toBe('binary');

    const c = side('sha-c', metricsFor('cube-20mm.stl'));
    const d = side('sha-d', null);
    expect(classifyChange(c, d)).toBe('binary');
  });

  it('throws when both sides are null', () => {
    expect(() => classifyChange(null, null)).toThrow();
  });
});
