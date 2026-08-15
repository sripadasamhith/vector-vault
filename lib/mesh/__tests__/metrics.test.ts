import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseSTL } from '../parse';
import { computeMetrics } from '../metrics';

const FIXTURES = path.resolve(__dirname, '../../../fixtures');

function loadFixture(name: string): ArrayBuffer {
  const buf = readFileSync(path.join(FIXTURES, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function metricsFor(name: string) {
  const positions = parseSTL(loadFixture(name));
  return computeMetrics(positions, 'stl');
}

// Relative tolerance from fixtures/README.md: 0.1% on volume and area.
function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * 0.001 + 1e-9);
}

describe('computeMetrics — ground truth from fixtures/README.md', () => {
  it('cube-20mm.stl: 12 tris, volume 8000, area 2400, watertight', () => {
    const m = metricsFor('cube-20mm.stl');
    expect(m.triangleCount).toBe(12);
    expect(m.isWatertight).toBe(true);
    expect(m.volumeMm3).not.toBeNull();
    expectClose(m.volumeMm3!, 8000);
    expectClose(m.surfaceAreaMm2, 2400);
    expect(m.bbox.min).toEqual([0, 0, 0]);
    expect(m.bbox.max).toEqual([20, 20, 20]);
  });

  it('cube-20mm-ascii.stl: identical geometry to the binary cube', () => {
    const m = metricsFor('cube-20mm-ascii.stl');
    expect(m.triangleCount).toBe(12);
    expect(m.isWatertight).toBe(true);
    expectClose(m.volumeMm3!, 8000);
    expectClose(m.surfaceAreaMm2, 2400);
  });

  it('cube-20mm-refined.stl: 192 tris, identical volume/area to the plain cube (C6 anchor)', () => {
    const m = metricsFor('cube-20mm-refined.stl');
    expect(m.triangleCount).toBe(192);
    expect(m.isWatertight).toBe(true);
    expectClose(m.volumeMm3!, 8000);
    expectClose(m.surfaceAreaMm2, 2400);
  });

  it('open-shell.stl: volume null, not watertight — NOT ~6666', () => {
    const m = metricsFor('open-shell.stl');
    expect(m.triangleCount).toBe(10);
    expect(m.isWatertight).toBe(false);
    expect(m.volumeMm3).toBeNull();
    expectClose(m.surfaceAreaMm2, 2000);
  });

  it('bracket-v1.stl: volume 38400, area 9280', () => {
    const m = metricsFor('bracket-v1.stl');
    expect(m.isWatertight).toBe(true);
    expectClose(m.volumeMm3!, 38400);
    expectClose(m.surfaceAreaMm2, 9280);
  });

  it('bracket-v2.stl: volume 32000, area 8800', () => {
    const m = metricsFor('bracket-v2.stl');
    expect(m.isWatertight).toBe(true);
    expectClose(m.volumeMm3!, 32000);
    expectClose(m.surfaceAreaMm2, 8800);
  });
});
