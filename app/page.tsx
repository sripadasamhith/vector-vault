import Link from 'next/link';

const LIMITATIONS = [
  'No merge. Branch and choose; there is no combining of geometry.',
  'Diff detects and quantifies change, but does not localize it — it does not yet show where on the part something changed.',
  'Metrics assume millimetres unless the repo says otherwise.',
  'STEP and native CAD formats (SolidWorks, etc.) get storage, versioning, and sharing — no preview, no diff.',
  'Metrics are computed client-side in v1 and are not tamper-proof.',
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-12 px-6 py-16 sm:py-24">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Vector Vault
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-4xl">
            Version control, sharing, and git-style commands for CAD files from any tool.
          </h1>
          <p className="max-w-lg text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Upload STL, OBJ, 3MF, STEP, or a native CAD file. Vector Vault hashes it,
            versions it, and lets you <code className="font-mono text-sm">commit</code>,{' '}
            <code className="font-mono text-sm">branch</code>,{' '}
            <code className="font-mono text-sm">diff</code>, and{' '}
            <code className="font-mono text-sm">share</code> it the way you would a code
            repository — from a terminal-style command bar in the browser.
          </p>
          <div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
            What this doesn&apos;t do yet
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The research behind this build (see <code className="font-mono">kb/</code>) is
            explicit about where the honest line is. Rather than bury it, here it is:
          </p>
          <ul className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            {LIMITATIONS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-zinc-400" aria-hidden>
                  &middot;
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
