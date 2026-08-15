// Pure parsers over ArrayBuffer. No network, no database, no React
// (ARCHITECTURE.md §2, §7). Input is always treated as hostile: byte lengths
// are validated before every read, and malformed input throws ParseError
// rather than returning a plausible-but-wrong result.

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { ParseError } from './types';
import type { KnownFormat, ParsedMesh } from './types';
import { computeMetrics } from './metrics';

const EXTENSION_FORMAT: Record<string, KnownFormat> = {
  stl: 'stl',
  obj: 'obj',
  '3mf': '3mf',
  step: 'step',
  stp: 'step',
  iges: 'iges',
  igs: 'iges',
  sldprt: 'native',
  sldasm: 'native',
  catpart: 'native',
  catproduct: 'native',
  prt: 'native',
  x_t: 'native',
  x_b: 'native',
};

/**
 * Determine a file's format from its filename extension. This is a coarse,
 * up-front classification (stl vs obj vs step, ...) — it is NOT the binary
 * vs ASCII decision for STL, which must never trust a prefix and is made by
 * byte-length arithmetic inside parseSTL/isBinarySTL instead.
 */
export function detectFormat(filename: string): KnownFormat {
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return 'unknown';
  const ext = filename.slice(dot + 1).toLowerCase();
  return EXTENSION_FORMAT[ext] ?? 'unknown';
}

const STL_HEADER_BYTES = 80;
const STL_COUNT_BYTES = 4;
const STL_TRIANGLE_BYTES = 50; // 12 floats (normal + 3 verts) + 2-byte attribute count

/**
 * The one check that matters: a binary STL's size is fully determined by its
 * triangle count. The 80-byte header is free-form and may legally start with
 * the ASCII bytes "solid" — sniffing that prefix misclassifies such files.
 * See ARCHITECTURE.md §7 and fixtures/cube-20mm.stl.
 */
function isBinarySTL(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < STL_HEADER_BYTES + STL_COUNT_BYTES) return false;
  const dv = new DataView(buffer);
  const triangleCount = dv.getUint32(STL_HEADER_BYTES, true);
  const expected = STL_HEADER_BYTES + STL_COUNT_BYTES + STL_TRIANGLE_BYTES * triangleCount;
  return expected === buffer.byteLength;
}

function parseBinarySTL(buffer: ArrayBuffer): Float32Array {
  const dv = new DataView(buffer);
  const triangleCount = dv.getUint32(STL_HEADER_BYTES, true);
  const positions = new Float32Array(triangleCount * 9);
  let offset = STL_HEADER_BYTES + STL_COUNT_BYTES;
  let p = 0;
  for (let i = 0; i < triangleCount; i++) {
    offset += 12; // skip normal (3 floats)
    for (let v = 0; v < 3; v++) {
      positions[p++] = dv.getFloat32(offset, true);
      positions[p++] = dv.getFloat32(offset + 4, true);
      positions[p++] = dv.getFloat32(offset + 8, true);
      offset += 12;
    }
    offset += 2; // attribute byte count
  }
  if (offset !== buffer.byteLength) {
    throw new ParseError(
      `binary STL truncated: expected ${buffer.byteLength} bytes, consumed ${offset}`
    );
  }
  return positions;
}

const VERTEX_LINE = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;

function parseAsciiSTL(buffer: ArrayBuffer): Float32Array {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const trimmed = text.trimStart();
  if (!trimmed.toLowerCase().startsWith('solid')) {
    throw new ParseError(
      'not a valid STL: binary size arithmetic failed and no ASCII "solid" header found'
    );
  }
  const values: number[] = [];
  for (const match of text.matchAll(VERTEX_LINE)) {
    values.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
  }
  if (values.length === 0) {
    throw new ParseError('ASCII STL has a "solid" header but no vertex data');
  }
  if (values.length % 9 !== 0) {
    throw new ParseError(
      `ASCII STL vertex count is not a multiple of 3 triangles (found ${values.length / 3} vertices)`
    );
  }
  return new Float32Array(values);
}

/**
 * Parses either binary or ASCII STL bytes into a flat Float32Array of
 * triangle positions (9 floats per triangle: v0.xyz, v1.xyz, v2.xyz).
 */
export function parseSTL(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength === 0) {
    throw new ParseError('empty file: cannot be a valid STL');
  }
  if (isBinarySTL(buffer)) {
    return parseBinarySTL(buffer);
  }
  return parseAsciiSTL(buffer);
}

function flattenNonIndexed(geometry: THREE.BufferGeometry): Float32Array {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = nonIndexed.getAttribute('position');
  if (!posAttr) return new Float32Array(0);
  const out = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    out[i * 3] = posAttr.getX(i);
    out[i * 3 + 1] = posAttr.getY(i);
    out[i * 3 + 2] = posAttr.getZ(i);
  }
  return out;
}

function collectMeshPositions(root: THREE.Object3D): Float32Array {
  const chunks: Float32Array[] = [];
  let total = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if ((mesh as THREE.Mesh).isMesh && mesh.geometry) {
      const chunk = flattenNonIndexed(mesh.geometry as THREE.BufferGeometry);
      chunks.push(chunk);
      total += chunk.length;
    }
  });
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Parses OBJ text via three.js's OBJLoader. */
export function parseOBJ(buffer: ArrayBuffer): Float32Array {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  let group: THREE.Group;
  try {
    group = new OBJLoader().parse(text);
  } catch (err) {
    throw new ParseError(`OBJ parse failed: ${(err as Error).message}`);
  }
  const positions = collectMeshPositions(group);
  if (positions.length === 0) {
    throw new ParseError('OBJ contains no parseable mesh geometry');
  }
  return positions;
}

/** Parses a 3MF package via three.js's ThreeMFLoader. */
export function parse3MF(buffer: ArrayBuffer): Float32Array {
  let group: THREE.Group;
  try {
    group = new ThreeMFLoader().parse(buffer);
  } catch (err) {
    throw new ParseError(`3MF parse failed: ${(err as Error).message}`);
  }
  const positions = collectMeshPositions(group);
  if (positions.length === 0) {
    throw new ParseError('3MF contains no parseable mesh geometry');
  }
  return positions;
}

/**
 * Top-level convenience: detect format from filename, dispatch to the right
 * parser, and compute metrics. Formats without a supported parser are
 * reported as unparseable (C4) rather than thrown.
 */
export function parseMesh(
  buffer: ArrayBuffer,
  filename: string
): { kind: 'parsed'; mesh: ParsedMesh } | { kind: 'unparseable'; format: KnownFormat } {
  const format = detectFormat(filename);
  let positions: Float32Array;
  switch (format) {
    case 'stl':
      positions = parseSTL(buffer);
      break;
    case 'obj':
      positions = parseOBJ(buffer);
      break;
    case '3mf':
      positions = parse3MF(buffer);
      break;
    default:
      return { kind: 'unparseable', format };
  }
  const metrics = computeMetrics(positions, format);
  return { kind: 'parsed', mesh: { positions, metrics } };
}
