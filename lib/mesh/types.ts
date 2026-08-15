// Type contracts for lib/mesh/**. Defined once here per ARCHITECTURE.md §3 —
// import from this file everywhere else; never redeclare these shapes inline.

export type SupportedFormat = 'stl' | 'obj' | '3mf';
export type KnownFormat = SupportedFormat | 'step' | 'iges' | 'native' | 'unknown';

export interface MeshMetrics {
  format: KnownFormat;
  triangleCount: number;
  /** null when the mesh is not watertight — volume is meaningless then. */
  volumeMm3: number | null;
  surfaceAreaMm2: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  /** Area-weighted. */
  centroid: [number, number, number];
  isWatertight: boolean;
}

export interface ParsedMesh {
  positions: Float32Array; // flat xyz triples, 9 floats per triangle
  metrics: MeshMetrics;
}

/** Formats we cannot parse still get a row, with everything null. C4 in PLAN.md. */
export type MetricsResult =
  | { kind: 'parsed'; metrics: MeshMetrics }
  | { kind: 'unparseable'; format: KnownFormat };

/**
 * Thrown by lib/mesh/parse.ts when the input bytes cannot be interpreted as
 * the claimed or detected format (truncated buffer, malformed structure,
 * etc.). Never return a plausible-but-wrong parse result — throw instead.
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
