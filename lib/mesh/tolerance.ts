// Single source of truth for "close enough to call it the same geometry"
// (C6 in PLAN.md). Imported everywhere a tolerance check happens — never
// scattered as literals. Values are a starting guess; they will be tuned
// against real re-exported files (ARCHITECTURE.md §7).

export const TOLERANCE = {
  relativeVolume: 0.001, // 0.1%
  relativeSurfaceArea: 0.001,
  absoluteBboxMm: 0.01,
} as const;

/**
 * True when `a` and `b` are close enough to be considered the same value.
 * Pass `{ relative }` for volume/area (fraction of the larger magnitude) or
 * `{ absolute }` for bbox dimensions (mm).
 */
export function withinTolerance(
  a: number,
  b: number,
  tolerance: { relative: number } | { absolute: number }
): boolean {
  if ('relative' in tolerance) {
    const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
    return Math.abs(a - b) / scale <= tolerance.relative;
  }
  return Math.abs(a - b) <= tolerance.absolute;
}
