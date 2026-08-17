'use client';

// T3.3 (BUILD.md) / ARCHITECTURE.md §8. The synced side-by-side viewer for
// the compare page. Two halves:
//
//  - DualViewer: fetches + parses both sides' bytes (same pattern as
//    blob-viewer.tsx: signed URL -> fetch -> off-main-thread parse via the
//    T2.4 worker) and shows loading/error/unparseable states.
//  - DualCanvases: the actual three.js rendering, once both sides are
//    parsed. Side-by-side mode drives ONE OrbitControls instance attached
//    to the left canvas and copies camera.position/quaternion to the right
//    camera every frame (ARCHITECTURE.md §8) — it does not reuse <Viewer>
//    directly because Viewer owns its own OrbitControls internally, which
//    is exactly the coupling this mode can't have. It does reuse Viewer's
//    frameCameraFromBbox()/addStandardLights() so the two don't drift.
//    Overlay mode is a single scene/camera/controls with B drawn at 50%
//    opacity on top of A, per PLAN.md §8's "cheap addition that helps a
//    lot".
//
// Same dispose discipline as T2.5, for both canvases in both modes: every
// geometry, material, renderer, and controls instance created in a mode's
// effect is disposed on mode change or unmount.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { frameCameraFromBbox, addStandardLights } from './viewer';
import { getBlobDownloadUrl } from '@/lib/client-api';
import { useMeshWorker } from '@/lib/mesh/useMeshWorker';
import type { MeshMetrics } from '@/lib/mesh/types';

interface MeshSide {
  positions: Float32Array;
  bbox: MeshMetrics['bbox'];
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'unparseable' }
  | { phase: 'ready'; a: MeshSide; b: MeshSide };

type Mode = 'side-by-side' | 'overlay';

function unionBbox(a: MeshMetrics['bbox'], b: MeshMetrics['bbox']): MeshMetrics['bbox'] {
  return {
    min: [
      Math.min(a.min[0], b.min[0]),
      Math.min(a.min[1], b.min[1]),
      Math.min(a.min[2], b.min[2]),
    ],
    max: [
      Math.max(a.max[0], b.max[0]),
      Math.max(a.max[1], b.max[1]),
      Math.max(a.max[2], b.max[2]),
    ],
  };
}

const MATERIAL_A = { color: 0x9db4c9, metalness: 0.15, roughness: 0.55 };
const MATERIAL_B_OVERLAY = { color: 0xe8a33d, metalness: 0.15, roughness: 0.55 };

function DualCanvases({ a, b }: { a: MeshSide; b: MeshSide }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('side-by-side');
  const [wireframe, setWireframe] = useState(false);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  // Wireframe toggles materials in place — no need to rebuild the scene.
  useEffect(() => {
    for (const m of materialsRef.current) m.wireframe = wireframe;
  }, [wireframe, mode]);

  useEffect(() => {
    materialsRef.current = [];
    let cleanup = () => {};

    if (mode === 'side-by-side') {
      const left = leftRef.current;
      const right = rightRef.current;
      if (!left || !right) return;

      const build = (container: HTMLDivElement, side: MeshSide) => {
        const width = container.clientWidth || 1;
        const height = container.clientHeight || 1;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111214);
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 1e7);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(side.positions, 3));
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({
          ...MATERIAL_A,
          side: THREE.DoubleSide,
          wireframe,
        });
        materialsRef.current.push(material);
        scene.add(new THREE.Mesh(geometry, material));
        addStandardLights(scene);

        return { scene, camera, renderer, geometry, material, container };
      };

      const left3d = build(left, a);
      const right3d = build(right, b);

      const center = frameCameraFromBbox(left3d.camera, a.bbox);
      frameCameraFromBbox(right3d.camera, b.bbox);

      // One OrbitControls, attached to the left canvas (ARCHITECTURE.md
      // §8) — the right camera never gets its own controls, it's driven
      // from this one every frame below.
      const controls = new OrbitControls(left3d.camera, left3d.renderer.domElement);
      controls.target.copy(center);
      controls.update();

      let frameId = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        controls.update();
        right3d.camera.position.copy(left3d.camera.position);
        right3d.camera.quaternion.copy(left3d.camera.quaternion);
        left3d.renderer.render(left3d.scene, left3d.camera);
        right3d.renderer.render(right3d.scene, right3d.camera);
      };
      animate();

      const handleResize = () => {
        for (const s of [left3d, right3d]) {
          const w = s.container.clientWidth || 1;
          const h = s.container.clientHeight || 1;
          s.camera.aspect = w / h;
          s.camera.updateProjectionMatrix();
          s.renderer.setSize(w, h);
        }
      };
      window.addEventListener('resize', handleResize);
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(left);
      resizeObserver.observe(right);

      cleanup = () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        controls.dispose();
        for (const s of [left3d, right3d]) {
          s.geometry.dispose();
          s.material.dispose();
          s.renderer.dispose();
          s.renderer.forceContextLoss();
          if (s.renderer.domElement.parentNode === s.container) {
            s.container.removeChild(s.renderer.domElement);
          }
        }
      };
    } else {
      // Overlay: one scene, A opaque + B at 50% opacity, one OrbitControls.
      const container = leftRef.current;
      if (!container) return;

      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111214);
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 1e7);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      const geomA = new THREE.BufferGeometry();
      geomA.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
      geomA.computeVertexNormals();
      const matA = new THREE.MeshStandardMaterial({ ...MATERIAL_A, side: THREE.DoubleSide, wireframe });
      scene.add(new THREE.Mesh(geomA, matA));

      const geomB = new THREE.BufferGeometry();
      geomB.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
      geomB.computeVertexNormals();
      const matB = new THREE.MeshStandardMaterial({
        ...MATERIAL_B_OVERLAY,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        wireframe,
      });
      scene.add(new THREE.Mesh(geomB, matB));

      materialsRef.current = [matA, matB];
      addStandardLights(scene);

      const center = frameCameraFromBbox(camera, unionBbox(a.bbox, b.bbox));

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(center);
      controls.update();

      let frameId = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        const w = container.clientWidth || 1;
        const h = container.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      cleanup = () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        controls.dispose();
        geomA.dispose();
        matA.dispose();
        geomB.dispose();
        matB.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    }

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, mode]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setWireframe((w) => !w)}
          className="rounded border border-black/10 px-2 py-1 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          {wireframe ? 'Wireframe: on' : 'Wireframe: off'}
        </button>
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'side-by-side' ? 'overlay' : 'side-by-side'))}
          className="rounded border border-black/10 px-2 py-1 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          {mode === 'side-by-side' ? 'Overlay (50% opacity)' : 'Side by side'}
        </button>
      </div>

      {mode === 'side-by-side' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div
            ref={leftRef}
            className="h-[380px] w-full rounded border border-black/10 dark:border-white/10"
          />
          <div
            ref={rightRef}
            className="h-[380px] w-full rounded border border-black/10 dark:border-white/10"
          />
        </div>
      ) : (
        <div
          ref={leftRef}
          className="h-[420px] w-full rounded border border-black/10 dark:border-white/10"
        />
      )}
    </div>
  );
}

export interface DualViewerProps {
  shaA: string;
  filenameA: string;
  shaB: string;
  filenameB: string;
}

export function DualViewer({ shaA, filenameA, shaB, filenameB }: DualViewerProps) {
  const { parseBuffer } = useMeshWorker();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });

    (async () => {
      const loadSide = async (sha256: string, filename: string): Promise<MeshSide | null> => {
        const urlResult = await getBlobDownloadUrl(sha256);
        if ('error' in urlResult) throw new Error(urlResult.error.message);
        const res = await fetch(urlResult.data.url);
        if (!res.ok) throw new Error(`Failed to download ${filename} (status ${res.status}).`);
        const buffer = await res.arrayBuffer();
        const response = await parseBuffer(filename, buffer);
        if (response.kind === 'parsed') {
          return { positions: response.positions, bbox: response.metrics.bbox };
        }
        return null;
      };

      const [a, b] = await Promise.all([
        loadSide(shaA, filenameA),
        loadSide(shaB, filenameB),
      ]);
      if (cancelled) return;

      if (!a || !b) {
        setState({ phase: 'unparseable' });
        return;
      }
      setState({ phase: 'ready', a, b });
    })().catch((err: unknown) => {
      if (!cancelled) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Failed to load preview.',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shaA, filenameA, shaB, filenameB, parseBuffer]);

  if (state.phase === 'loading') {
    return <p className="text-sm text-zinc-500">Loading preview...</p>;
  }
  if (state.phase === 'error') {
    return <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>;
  }
  if (state.phase === 'unparseable') {
    return (
      <p className="text-sm text-zinc-500">
        Preview unavailable for one or both sides of this file — the files are stored and
        versioned.
      </p>
    );
  }

  return <DualCanvases a={state.a} b={state.b} />;
}
