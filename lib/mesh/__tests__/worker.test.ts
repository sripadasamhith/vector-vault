import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { computeWorkerResponse } from '../worker';

const FIXTURES = path.resolve(__dirname, '../../../fixtures');

function loadFixture(name: string): ArrayBuffer {
  const buf = readFileSync(path.join(FIXTURES, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('computeWorkerResponse — worker message contract', () => {
  it('returns a parsed response with metrics for a supported format', () => {
    const response = computeWorkerResponse({
      id: 'req-1',
      filename: 'cube-20mm.stl',
      buffer: loadFixture('cube-20mm.stl'),
    });
    expect(response.id).toBe('req-1');
    expect(response.kind).toBe('parsed');
    if (response.kind !== 'parsed') throw new Error('expected parsed');
    expect(response.positions.length / 9).toBe(12);
    expect(response.metrics.isWatertight).toBe(true);
    expect(response.metrics.volumeMm3).toBeCloseTo(8000, 1);
  });

  it('returns unparseable (not a throw) for a format with no parser', () => {
    const response = computeWorkerResponse({
      id: 'req-2',
      filename: 'part.step',
      buffer: loadFixture('part.step'),
    });
    expect(response).toEqual({ id: 'req-2', kind: 'unparseable', format: 'step' });
  });

  it('returns unparseable for an opaque native CAD format', () => {
    const response = computeWorkerResponse({
      id: 'req-3',
      filename: 'part.sldprt',
      buffer: loadFixture('part.sldprt'),
    });
    expect(response).toEqual({ id: 'req-3', kind: 'unparseable', format: 'native' });
  });

  it('degrades to unparseable, never throws, when a claimed-supported format is corrupt', () => {
    const buf = loadFixture('cube-20mm.stl');
    const truncated = buf.slice(0, buf.byteLength - 10);
    const response = computeWorkerResponse({
      id: 'req-4',
      filename: 'cube-20mm.stl',
      buffer: truncated,
    });
    expect(response).toEqual({ id: 'req-4', kind: 'unparseable', format: 'stl' });
  });

  it('degrades to unparseable for a completely unknown extension', () => {
    const response = computeWorkerResponse({
      id: 'req-5',
      filename: 'mystery.xyz',
      buffer: new ArrayBuffer(4),
    });
    expect(response).toEqual({ id: 'req-5', kind: 'unparseable', format: 'unknown' });
  });
});
