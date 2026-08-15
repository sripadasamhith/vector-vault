import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { detectFormat, parseSTL, parseMesh } from '../parse';
import { ParseError } from '../types';

const FIXTURES = path.resolve(__dirname, '../../../fixtures');

function loadFixture(name: string): ArrayBuffer {
  const buf = readFileSync(path.join(FIXTURES, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('detectFormat', () => {
  it('maps extensions to formats', () => {
    expect(detectFormat('cube.stl')).toBe('stl');
    expect(detectFormat('part.obj')).toBe('obj');
    expect(detectFormat('part.3mf')).toBe('3mf');
    expect(detectFormat('part.step')).toBe('step');
    expect(detectFormat('part.sldprt')).toBe('native');
    expect(detectFormat('part.xyz')).toBe('unknown');
    expect(detectFormat('noextension')).toBe('unknown');
  });
});

describe('parseSTL — binary vs ASCII detection', () => {
  it('parses cube-20mm.stl as BINARY despite its "solid" header trap', () => {
    const buf = loadFixture('cube-20mm.stl');
    // The header of this file begins with the literal ASCII bytes "solid".
    // A prefix-sniffing parser would misclassify this as ASCII.
    const header = new TextDecoder().decode(buf.slice(0, 5));
    expect(header).toBe('solid');

    const positions = parseSTL(buf);
    expect(positions.length / 9).toBe(12); // 12 triangles
  });

  it('parses cube-20mm-ascii.stl as ASCII with identical triangle count', () => {
    const buf = loadFixture('cube-20mm-ascii.stl');
    const positions = parseSTL(buf);
    expect(positions.length / 9).toBe(12);
  });

  it('parses cube-20mm-refined.stl to 192 triangles', () => {
    const buf = loadFixture('cube-20mm-refined.stl');
    const positions = parseSTL(buf);
    expect(positions.length / 9).toBe(192);
  });

  it('parses open-shell.stl to 10 triangles', () => {
    const buf = loadFixture('open-shell.stl');
    const positions = parseSTL(buf);
    expect(positions.length / 9).toBe(10);
  });

  it('throws ParseError on a truncated binary STL', () => {
    const buf = loadFixture('cube-20mm.stl');
    const truncated = buf.slice(0, buf.byteLength - 10);
    expect(() => parseSTL(truncated)).toThrow(ParseError);
  });

  it('throws ParseError on an empty buffer', () => {
    expect(() => parseSTL(new ArrayBuffer(0))).toThrow(ParseError);
  });

  it('throws ParseError on garbage bytes that are neither valid binary nor ASCII', () => {
    const garbage = new Uint8Array(200).fill(0x42).buffer;
    expect(() => parseSTL(garbage)).toThrow(ParseError);
  });
});

describe('parseMesh — end to end', () => {
  it('reports full metrics for cube-20mm.stl', () => {
    const result = parseMesh(loadFixture('cube-20mm.stl'), 'cube-20mm.stl');
    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') throw new Error('expected parsed');
    expect(result.mesh.metrics.triangleCount).toBe(12);
    expect(result.mesh.metrics.isWatertight).toBe(true);
    expect(result.mesh.metrics.volumeMm3).not.toBeNull();
    expect(result.mesh.metrics.volumeMm3!).toBeCloseTo(8000, 1);
  });

  it('reports unparseable for a STEP file', () => {
    const result = parseMesh(loadFixture('part.step'), 'part.step');
    expect(result.kind).toBe('unparseable');
    if (result.kind !== 'unparseable') throw new Error('expected unparseable');
    expect(result.format).toBe('step');
  });

  it('reports unparseable for an .sldprt file', () => {
    const result = parseMesh(loadFixture('part.sldprt'), 'part.sldprt');
    expect(result.kind).toBe('unparseable');
    if (result.kind !== 'unparseable') throw new Error('expected unparseable');
    expect(result.format).toBe('native');
  });
});
