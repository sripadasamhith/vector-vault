'use client';

// T1.3 (BUILD.md) — the client half of ARCHITECTURE.md §4's upload flow.
// Deliberately does NOT send the file to a Next.js route: it hashes locally,
// asks /api/uploads/sign (via lib/client-api.ts) for either a green light to
// skip the upload (`alreadyExists`) or a signed URL, then uploads straight
// to Supabase Storage with the browser client. If you find this component
// building a FormData for fetch('/api/...') with the file body attached,
// that is the specific mistake ARCHITECTURE.md §4 warns about — stop.
//
// Progress: the storage-js `uploadToSignedUrl` helper (used here exactly as
// BUILD.md T1.3 specifies) wraps `fetch` and does not expose upload
// byte-progress events — only XHR does, and re-implementing the signed-URL
// PUT by hand to get progress percentages would mean not using the
// documented helper. What IS honestly knowable and shown here is *phase*
// progress (hashing -> requesting URL -> uploading -> done), which is what
// the UI renders per file.

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signUpload, type StageMetricsInput } from '@/lib/client-api';
import { useMeshWorker } from '@/lib/mesh/useMeshWorker';
import type { MeshWorkerResponse } from '@/lib/mesh/worker';

export type UploadPhase =
  | 'hashing'
  | 'requesting-url'
  | 'uploading'
  | 'done'
  | 'skipped-duplicate'
  | 'error';

export interface UploadItem {
  file: File;
  path: string;
  phase: UploadPhase;
  sha256?: string;
  error?: string;
}

export interface UploadedFile {
  path: string;
  sha256: string;
  size: number;
  filename: string;
  /** Computed off the main thread by the T2.4 mesh worker. Null when the
   * format has no parser (C4) or the bytes were corrupt — the file still
   * uploads either way. */
  metrics: StageMetricsInput | null;
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toStageMetrics(response: MeshWorkerResponse): StageMetricsInput {
  if (response.kind === 'parsed') {
    const m = response.metrics;
    return {
      format: m.format,
      triangleCount: m.triangleCount,
      volumeMm3: m.volumeMm3,
      surfaceAreaMm2: m.surfaceAreaMm2,
      bbox: m.bbox,
      centroid: m.centroid,
      isWatertight: m.isWatertight,
    };
  }
  return {
    format: response.format,
    triangleCount: null,
    volumeMm3: null,
    surfaceAreaMm2: null,
    bbox: null,
    centroid: null,
    isWatertight: null,
  };
}

interface UploadDropzoneProps {
  /** Called once per file after it is either uploaded or confirmed already
   * present in storage — i.e. once it is safe to stage. */
  onUploaded: (result: UploadedFile) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onUploaded, disabled }: UploadDropzoneProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const { parseBuffer } = useMeshWorker();

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      for (const file of files) {
        const path = file.name;
        setItems((prev) => [...prev, { file, path, phase: 'hashing' }]);

        const update = (patch: Partial<UploadItem>) =>
          setItems((prev) => prev.map((it) => (it.file === file ? { ...it, ...patch } : it)));

        try {
          const buf = await file.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', buf);
          const sha256 = bufferToHex(digest);
          update({ phase: 'requesting-url', sha256 });

          // Off the main thread (T2.4): hand the already-read buffer to the
          // Web Worker for parsing + metrics while the sign/upload calls
          // below are in flight. `buf` is transferred, not copied, and must
          // not be touched again after this call.
          const metricsPromise = parseBuffer(file.name, buf).catch(
            (): MeshWorkerResponse => ({ id: '', kind: 'unparseable', format: 'unknown' })
          );

          const signResult = await signUpload({ sha256, filename: file.name, size: file.size });
          if ('error' in signResult) {
            update({ phase: 'error', error: signResult.error.message });
            continue;
          }

          if (signResult.data.alreadyExists) {
            update({ phase: 'skipped-duplicate' });
            const metrics = toStageMetrics(await metricsPromise);
            onUploaded({ path, sha256, size: file.size, filename: file.name, metrics });
            continue;
          }

          update({ phase: 'uploading' });
          const supabase = createClient();
          const { error: uploadError } = await supabase.storage
            .from('designs')
            .uploadToSignedUrl(signResult.data.path, signResult.data.token, file);

          if (uploadError) {
            update({ phase: 'error', error: uploadError.message });
            continue;
          }

          update({ phase: 'done' });
          const metrics = toStageMetrics(await metricsPromise);
          onUploaded({ path, sha256, size: file.size, filename: file.name, metrics });
        } catch (err) {
          update({ phase: 'error', error: err instanceof Error ? err.message : 'Upload failed.' });
        }
      }
    },
    [onUploaded, parseBuffer]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && e.dataTransfer.files.length > 0) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed px-6 py-10 text-center text-sm transition-colors ${
          dragOver
            ? 'border-black/40 bg-black/5 dark:border-white/40 dark:bg-white/10'
            : 'border-black/15 dark:border-white/15'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <p className="text-zinc-600 dark:text-zinc-400">
          Drag files here, or
          <label className="ml-1 cursor-pointer font-medium text-black underline dark:text-zinc-50">
            browse
            <input
              type="file"
              multiple
              disabled={disabled}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void handleFiles(e.target.files);
                }
                e.target.value = '';
              }}
            />
          </label>
        </p>
      </div>

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs">
          {items.map((item, i) => (
            <li key={`${item.path}-${i}`} className="flex items-center justify-between gap-2">
              <span className="truncate text-zinc-700 dark:text-zinc-300">{item.path}</span>
              <span
                className={
                  item.phase === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : item.phase === 'done' || item.phase === 'skipped-duplicate'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-zinc-500'
                }
              >
                {item.phase === 'error' ? (item.error ?? 'error') : item.phase}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
