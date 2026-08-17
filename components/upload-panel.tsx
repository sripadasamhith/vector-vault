'use client';

// T1.8 — wires T1.3's dropzone to T1.4's stage endpoint: upload, then stage
// automatically (PLAN.md §6: "upload UI stages automatically"), then
// refresh the server-rendered file list so a subsequent `commit` has
// something to work with.
import { useRouter } from 'next/navigation';
import { UploadDropzone, type UploadedFile } from './upload-dropzone';
import { stageFile } from '@/lib/client-api';

export function UploadPanel({ repoId, branch }: { repoId: string; branch: string }) {
  const router = useRouter();

  async function handleUploaded(file: UploadedFile) {
    const result = await stageFile(repoId, {
      path: file.path,
      sha256: file.sha256,
      size: file.size,
      branch,
      metrics: file.metrics,
    });
    if ('error' in result) {
      // upload-dropzone already shows a per-file error state; staging
      // failures are rarer (e.g. role changed mid-upload) and surfaced the
      // same honest way rather than silently dropped.
      console.error('stage failed:', result.error.message);
      return;
    }
    router.refresh();
  }

  return <UploadDropzone onUploaded={handleUploaded} />;
}
