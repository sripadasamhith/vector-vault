import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { classifyChange, buildMetricDeltas, buildDiffFileChanges, type FileSide } from '../diff';
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

describe('buildMetricDeltas — T3.2 formatting and significance', () => {
  it('bracket-v1 -> bracket-v2: a real, significant change, preformatted per BUILD.md T3.2', () => {
    const a = metricsFor('bracket-v1.stl');
    const b = metricsFor('bracket-v2.stl');
    const deltas = buildMetricDeltas(a, b);

    const byLabel = Object.fromEntries(deltas.map((d) => [d.label, d]));

    // fixtures/README.md: 38400 -> 32000 mm^3 => 38.40 -> 32.00 cm^3, -16.67%.
    expect(byLabel.volume.a).toBe('38.40 cm³');
    expect(byLabel.volume.b).toBe('32.00 cm³');
    expect(byLabel.volume.deltaPct).toBeCloseTo(-16.666666, 3);
    expect(byLabel.volume.significant).toBe(true);

    // 9280 -> 8800 mm^2 => 92.80 -> 88.00 cm^2, -5.17%.
    expect(byLabel['surface area'].a).toBe('92.80 cm²');
    expect(byLabel['surface area'].b).toBe('88.00 cm²');
    expect(byLabel['surface area'].significant).toBe(true);

    // bbox Z: 12 -> 10mm, a real, significant dimension change.
    expect(byLabel['bounding box'].a).toBe('80×40×12 mm');
    expect(byLabel['bounding box'].b).toBe('80×40×10 mm');
    expect(byLabel['bounding box'].significant).toBe(true);

    expect(byLabel.triangles.a).toBe('12');
    expect(byLabel.triangles.b).toBe('12');
    expect(byLabel.triangles.significant).toBe(false);

    expect(byLabel.watertight.a).toBe('yes');
    expect(byLabel.watertight.b).toBe('yes');
    expect(byLabel.watertight.significant).toBe(false);
  });

  it('cube-20mm -> cube-20mm-refined: the C6 case, no delta is significant', () => {
    const a = metricsFor('cube-20mm.stl');
    const b = metricsFor('cube-20mm-refined.stl');
    const deltas = buildMetricDeltas(a, b);

    for (const d of deltas) {
      expect(d.significant, `${d.label} should not be significant`).toBe(false);
    }

    const byLabel = Object.fromEntries(deltas.map((d) => [d.label, d]));
    expect(byLabel.volume.a).toBe('8.00 cm³');
    expect(byLabel.volume.b).toBe('8.00 cm³');
    expect(byLabel.triangles.a).toBe('12');
    expect(byLabel.triangles.b).toBe('192'); // informational, never "significant"
  });
});

/** Minimal stub of the one Supabase call buildDiffFileChanges() makes:
 * .from('blob_metrics').select('*').in('sha256', shas). */
function fakeSupabase(rows: Record<string, unknown>[]) {
  return {
    from(table: string) {
      if (table !== 'blob_metrics') throw new Error(`unexpected table: ${table}`);
      return {
        select() {
          return {
            in(_col: string, shas: string[]) {
              return Promise.resolve({
                data: rows.filter((r) => shas.includes(r.sha256 as string)),
                error: null,
              });
            },
          };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function metricsRow(sha256: string, name: string) {
  const m = metricsFor(name);
  return {
    sha256,
    format: m.format,
    triangle_count: m.triangleCount,
    volume_mm3: m.volumeMm3,
    surface_area_mm2: m.surfaceAreaMm2,
    bbox: m.bbox,
    centroid: m.centroid,
    is_watertight: m.isWatertight,
  };
}

describe('buildDiffFileChanges — shaping (T3.2)', () => {
  it('classifies every path correctly and only populates deltas for modified/reexported', async () => {
    const supabase = fakeSupabase([
      metricsRow('sha-cube', 'cube-20mm.stl'),
      metricsRow('sha-refined', 'cube-20mm-refined.stl'),
      metricsRow('sha-v1', 'bracket-v1.stl'),
      metricsRow('sha-v2', 'bracket-v2.stl'),
      { sha256: 'sha-native', format: 'native', triangle_count: null, volume_mm3: null, surface_area_mm2: null, bbox: null, centroid: null, is_watertight: null },
      { sha256: 'sha-native-2', format: 'native', triangle_count: null, volume_mm3: null, surface_area_mm2: null, bbox: null, centroid: null, is_watertight: null },
    ]);

    const filesA = [
      { path: 'reexported.stl', sha256: 'sha-cube' },
      { path: 'bracket.stl', sha256: 'sha-v1' },
      { path: 'removed.stl', sha256: 'sha-cube' },
      { path: 'part.sldprt', sha256: 'sha-native' },
      { path: 'same.stl', sha256: 'sha-cube' },
    ];
    const filesB = [
      { path: 'reexported.stl', sha256: 'sha-refined' },
      { path: 'bracket.stl', sha256: 'sha-v2' },
      { path: 'added.stl', sha256: 'sha-cube' },
      { path: 'part.sldprt', sha256: 'sha-native-2' },
      { path: 'same.stl', sha256: 'sha-cube' },
    ];

    const changes = await buildDiffFileChanges(supabase, filesA, filesB);
    const byPath = Object.fromEntries(changes.map((c) => [c.path, c]));

    expect(byPath['same.stl']).toBeUndefined(); // unchanged paths are omitted

    expect(byPath['reexported.stl'].kind).toBe('reexported');
    expect(byPath['reexported.stl'].deltas.length).toBe(5);

    expect(byPath['bracket.stl'].kind).toBe('modified');
    const volumeDelta = byPath['bracket.stl'].deltas.find((d) => d.label === 'volume');
    expect(volumeDelta?.significant).toBe(true);
    expect(volumeDelta?.a).toBe('38.40 cm³');

    expect(byPath['added.stl'].kind).toBe('added');
    expect(byPath['added.stl'].deltas).toEqual([]);
    expect(byPath['added.stl'].shaA).toBeNull();

    expect(byPath['removed.stl'].kind).toBe('removed');
    expect(byPath['removed.stl'].deltas).toEqual([]);
    expect(byPath['removed.stl'].shaB).toBeNull();

    expect(byPath['part.sldprt'].kind).toBe('binary');
    expect(byPath['part.sldprt'].deltas).toEqual([]);
  });
});
