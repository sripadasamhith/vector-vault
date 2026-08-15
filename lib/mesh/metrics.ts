// Pure geometry math over a flat triangle-soup positions array. No network,
// no database, no React (ARCHITECTURE.md §2, §7).

import type { KnownFormat, MeshMetrics } from './types';

type Vec3 = [number, number, number];

const QUANTIZE = 1e-6;

function quantizeKey(v: Vec3): string {
  // Round to 1e-6 so float noise from re-tessellation / re-export does not
  // split what is geometrically the same vertex (ARCHITECTURE.md §7).
  const q = (x: number) => (Math.round(x / QUANTIZE) * QUANTIZE).toFixed(6);
  return `${q(v[0])},${q(v[1])},${q(v[2])}`;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

/**
 * Watertight iff every undirected edge appears exactly twice, once in each
 * direction (consistent outward winding). Vertex coordinates are quantized
 * so float noise from re-tessellation doesn't split shared vertices.
 */
function checkWatertight(triangles: [Vec3, Vec3, Vec3][]): boolean {
  const directed = new Map<string, number>();
  const undirected = new Map<string, number>();

  for (const [a, b, c] of triangles) {
    const ka = quantizeKey(a);
    const kb = quantizeKey(b);
    const kc = quantizeKey(c);
    const edges: [string, string][] = [
      [ka, kb],
      [kb, kc],
      [kc, ka],
    ];
    for (const [u, v] of edges) {
      if (u === v) continue; // degenerate edge, ignore
      const dKey = `${u}>${v}`;
      directed.set(dKey, (directed.get(dKey) ?? 0) + 1);
      const uKey = u < v ? `${u}|${v}` : `${v}|${u}`;
      undirected.set(uKey, (undirected.get(uKey) ?? 0) + 1);
    }
  }

  if (undirected.size === 0) return false;

  for (const [uKey, count] of undirected) {
    if (count !== 2) return false;
    const [u, v] = uKey.split('|');
    const forward = directed.get(`${u}>${v}`) ?? 0;
    const backward = directed.get(`${v}>${u}`) ?? 0;
    if (forward !== 1 || backward !== 1) return false;
  }
  return true;
}

/**
 * Computes MeshMetrics from a flat Float32Array of triangle positions
 * (9 floats per triangle: v0.xyz, v1.xyz, v2.xyz). Volume is null unless the
 * mesh is watertight — the signed-tetrahedron sum returns a number for open
 * meshes too, but it is meaningless there.
 */
export function computeMetrics(positions: Float32Array, format: KnownFormat): MeshMetrics {
  const triangleCount = Math.floor(positions.length / 9);

  if (triangleCount === 0) {
    return {
      format,
      triangleCount: 0,
      volumeMm3: null,
      surfaceAreaMm2: 0,
      bbox: { min: [0, 0, 0], max: [0, 0, 0] },
      centroid: [0, 0, 0],
      isWatertight: false,
    };
  }

  const triangles: [Vec3, Vec3, Vec3][] = new Array(triangleCount);

  let signedVol6 = 0;
  let totalArea = 0;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const weightedCentroidSum: Vec3 = [0, 0, 0];

  for (let i = 0; i < triangleCount; i++) {
    const o = i * 9;
    const v0: Vec3 = [positions[o], positions[o + 1], positions[o + 2]];
    const v1: Vec3 = [positions[o + 3], positions[o + 4], positions[o + 5]];
    const v2: Vec3 = [positions[o + 6], positions[o + 7], positions[o + 8]];
    triangles[i] = [v0, v1, v2];

    // Signed tetrahedron sum: Σ (v0 · (v1 × v2)) / 6
    signedVol6 += dot(v0, cross(v1, v2));

    // Triangle area = 0.5 |edge1 × edge2|
    const edge1 = sub(v1, v0);
    const edge2 = sub(v2, v0);
    const triArea = 0.5 * length(cross(edge1, edge2));
    totalArea += triArea;

    const triCentroid: Vec3 = [
      (v0[0] + v1[0] + v2[0]) / 3,
      (v0[1] + v1[1] + v2[1]) / 3,
      (v0[2] + v1[2] + v2[2]) / 3,
    ];
    weightedCentroidSum[0] += triCentroid[0] * triArea;
    weightedCentroidSum[1] += triCentroid[1] * triArea;
    weightedCentroidSum[2] += triCentroid[2] * triArea;

    for (const v of [v0, v1, v2]) {
      for (let k = 0; k < 3; k++) {
        if (v[k] < min[k]) min[k] = v[k];
        if (v[k] > max[k]) max[k] = v[k];
      }
    }
  }

  const isWatertight = checkWatertight(triangles);
  const volumeMm3 = isWatertight ? Math.abs(signedVol6) / 6 : null;

  const centroid: Vec3 =
    totalArea > 0
      ? [
          weightedCentroidSum[0] / totalArea,
          weightedCentroidSum[1] / totalArea,
          weightedCentroidSum[2] / totalArea,
        ]
      : [0, 0, 0];

  return {
    format,
    triangleCount,
    volumeMm3,
    surfaceAreaMm2: totalArea,
    bbox: { min, max },
    centroid,
    isWatertight,
  };
}
