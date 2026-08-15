/**
 * End-to-end audit against fixtures/README.md ground truth.
 *
 * Written independently of lib/mesh's own unit tests: these assert on real
 * fixture BYTES through the full parse -> metrics -> classify path, using the
 * analytically-computed values from fixtures/generate.py as the specification.
 * If this file and the implementation disagree, the implementation is wrong.
 *
 * Keep these as regressions — they cover C6 (re-tessellation must not read as
 * a change) and the two planted traps described in fixtures/README.md.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSTL, detectFormat } from '../parse';
import { computeMetrics } from '../metrics';
import { classifyChange } from '../../domain/diff';

const F = join(process.cwd(), 'fixtures');

function load(name: string) {
  const b = readFileSync(join(F, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

function metricsOf(name: string) {
  return computeMetrics(parseSTL(load(name)), detectFormat(name));
}

describe('audit: ground-truth table', () => {
  it('cube-20mm.stl is BINARY despite a "solid" header, and is exact', () => {
    const raw = Buffer.from(load('cube-20mm.stl'));
    // Prove the trap is actually present in the file.
    expect(raw.subarray(0, 5).toString('ascii')).toBe('solid');
    const m = metricsOf('cube-20mm.stl');
    expect(m.triangleCount).toBe(12);
    expect(m.volumeMm3).toBeCloseTo(8000, 2);
    expect(m.surfaceAreaMm2).toBeCloseTo(2400, 2);
    expect(m.isWatertight).toBe(true);
    expect(m.bbox.min).toEqual([0, 0, 0]);
    expect(m.bbox.max).toEqual([20, 20, 20]);
    expect(m.centroid[0]).toBeCloseTo(10, 4);
    expect(m.centroid[1]).toBeCloseTo(10, 4);
    expect(m.centroid[2]).toBeCloseTo(10, 4);
  });

  it('ascii cube matches binary cube', () => {
    const m = metricsOf('cube-20mm-ascii.stl');
    expect(m.triangleCount).toBe(12);
    expect(m.volumeMm3).toBeCloseTo(8000, 2);
    expect(m.surfaceAreaMm2).toBeCloseTo(2400, 2);
    expect(m.isWatertight).toBe(true);
  });

  it('refined cube: 192 tris, identical volume and area', () => {
    const m = metricsOf('cube-20mm-refined.stl');
    expect(m.triangleCount).toBe(192);
    expect(m.volumeMm3).toBeCloseTo(8000, 2);
    expect(m.surfaceAreaMm2).toBeCloseTo(2400, 2);
    expect(m.isWatertight).toBe(true);
  });

  it('open shell: volume null, not ~6666', () => {
    const m = metricsOf('open-shell.stl');
    expect(m.triangleCount).toBe(10);
    expect(m.isWatertight).toBe(false);
    expect(m.volumeMm3).toBeNull();
    expect(m.surfaceAreaMm2).toBeCloseTo(2000, 2);
  });

  it('bracket v1/v2 volumes', () => {
    expect(metricsOf('bracket-v1.stl').volumeMm3).toBeCloseTo(38400, 1);
    expect(metricsOf('bracket-v2.stl').volumeMm3).toBeCloseTo(32000, 1);
    expect(metricsOf('bracket-v1.stl').surfaceAreaMm2).toBeCloseTo(9280, 1);
    expect(metricsOf('bracket-v2.stl').surfaceAreaMm2).toBeCloseTo(8800, 1);
  });
});

describe('audit: C6 classification on real fixture bytes', () => {
  const side = (n: string) => ({ sha256: n, metrics: metricsOf(n) });

  it('re-tessellated cube is reexported, NOT modified', () => {
    expect(classifyChange(side('cube-20mm.stl'), side('cube-20mm-refined.stl'))).toBe('reexported');
  });

  it('ascii vs binary cube is also reexported', () => {
    expect(classifyChange(side('cube-20mm.stl'), side('cube-20mm-ascii.stl'))).toBe('reexported');
  });

  it('a real geometry change is still modified', () => {
    expect(classifyChange(side('bracket-v1.stl'), side('bracket-v2.stl'))).toBe('modified');
  });

  it('watertight vs open is modified, not hidden', () => {
    expect(classifyChange(side('cube-20mm.stl'), side('open-shell.stl'))).toBe('modified');
  });

  it('unparseable side is binary', () => {
    expect(
      classifyChange({ sha256: 'a', metrics: null }, { sha256: 'b', metrics: null })
    ).toBe('binary');
  });
});

describe('audit: hostile input', () => {
  it('truncated binary STL throws', () => {
    const full = new Uint8Array(load('cube-20mm.stl'));
    const cut = full.slice(0, 200);
    expect(() => parseSTL(cut.buffer as ArrayBuffer)).toThrow();
  });

  it('empty buffer throws', () => {
    expect(() => parseSTL(new ArrayBuffer(0))).toThrow();
  });

  it('a header claiming a huge triangle count throws rather than allocating', () => {
    const buf = new ArrayBuffer(84);
    new DataView(buf).setUint32(80, 4_000_000_000, true);
    expect(() => parseSTL(buf)).toThrow();
  });
});
