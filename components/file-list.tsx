// T1.8. Server-renderable — takes plain data, no client state.
import type { CommitFile } from '@/lib/domain/commits';

function formatSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function FileList({ files }: { files: CommitFile[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-zinc-500">No files yet.</p>;
  }

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-zinc-500">
          <th className="border-b border-black/10 pb-2 pr-4 font-medium dark:border-white/10">
            Path
          </th>
          <th className="border-b border-black/10 pb-2 pr-4 font-medium dark:border-white/10">
            Size
          </th>
          <th className="border-b border-black/10 pb-2 font-medium dark:border-white/10">
            SHA
          </th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => (
          <tr key={f.path}>
            <td className="py-1.5 pr-4 font-mono text-black dark:text-zinc-100">{f.path}</td>
            <td className="py-1.5 pr-4 text-zinc-600 dark:text-zinc-400">
              {formatSize(f.sizeBytes)}
            </td>
            <td className="py-1.5 font-mono text-xs text-zinc-500">
              {(f.sha256 ?? '').slice(0, 7)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
