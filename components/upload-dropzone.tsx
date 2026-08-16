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
import { signUpload } from '@/lib/client-api';

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
}

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      for (const file of files) {
        const path = file.name;
        setItems((prev) => [...prev, { file, path, phase: 'hashing' }]);

        const update = (patch: Partial<UploadItem>) =>
          setItems((prev) => prev.map((it) => (it.file === file ? { ...it, ...patch } : it)));

        try {
          const sha256 = await hashFile(file);
          update({ phase: 'requesting-url', sha256 });

          const signResult = await signUpload({ sha256, filename: file.name, size: file.size });
          if ('error' in signResult) {
            update({ phase: 'error', error: signResult.error.message });
            continue;
          }

          if (signResult.data.alreadyExists) {
            update({ phase: 'skipped-duplicate' });
            onUploaded({ path, sha256, size: file.size, filename: file.name });
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
          onUploaded({ path, sha256, size: file.size, filename: file.name });
        } catch (err) {
          update({ phase: 'error', error: err instanceof Error ? err.message : 'Upload failed.' });
        }
      }
    },
    [onUploaded]
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
