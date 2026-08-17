'use client';

// T2.5 (BUILD.md) / ARCHITECTURE.md §8. One three.js canvas over an
// already-parsed mesh. This module is only ever reached through a
// `next/dynamic(..., { ssr: false })` import (see blob-viewer.tsx) — three.js
// touches `window` at module scope via WebGLRenderer and would break the RSC
// build if imported directly from a server component.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MeshMetrics } from '@/lib/mesh/types';

export interface ViewerProps {
  /** Flat xyz triples, 9 floats per triangle — transferred from the Web
   * Worker, never copied (ARCHITECTURE.md §7/§8). */
  positions: Float32Array;
  bbox: MeshMetrics['bbox'];
}

/**
 * Frames `camera` from a bbox rather than a fixed distance — parts range
 * from 2mm to 2m (ARCHITECTURE.md §8) — and returns the bbox center, which
 * OrbitControls.target should be set to. Exported so dual-viewer.tsx (T3.3)
 * reuses the exact same framing logic instead of re-deriving it.
 */
export function frameCameraFromBbox(
  camera: THREE.PerspectiveCamera,
  bbox: MeshMetrics['bbox']
): THREE.Vector3 {
  const min = new THREE.Vector3(...bbox.min);
  const max = new THREE.Vector3(...bbox.max);
  const center = min.clone().add(max).multiplyScalar(0.5);
  const size = max.clone().sub(min);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const distance = maxDim * 1.8;
  camera.position.set(center.x + distance, center.y + distance * 0.8, center.z + distance);
  camera.near = Math.max(maxDim / 1000, 1e-6);
  camera.far = Math.max(maxDim * 1000, distance * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  return center;
}

/** Shared three-point-ish lighting rig used by every viewer (Viewer,
 * DualViewer's two variants). */
export function addStandardLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(1, 1.4, 1);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-1, -0.6, -0.8);
  scene.add(fill);
}

export function Viewer({ positions, bbox }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x9db4c9,
      metalness: 0.15,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    addStandardLights(scene);

    // Frame the camera from the parsed bbox, never a fixed distance — parts
    // range from 2 mm to 2 m (ARCHITECTURE.md §8).
    const center = frameCameraFromBbox(camera, bbox);

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

    // Dispose geometry and materials on unmount (ARCHITECTURE.md §8) —
    // otherwise navigating between commits leaks GPU memory until the tab
    // crashes.
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [positions, bbox]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full rounded border border-black/10 dark:border-white/10"
    />
  );
}
