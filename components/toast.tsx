'use client';

// T5.3 — a small local toast system, no new dependencies. Wraps the whole
// app (mounted once in app/layout.tsx) so any client component can surface
// a non-blocking error/info message instead of a silent console.error or a
// dropped promise rejection. Deliberately minimal: no queue library, no
// animation library — just state + setTimeout.
import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastKind = 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  push: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = 'error') => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch gap-2 p-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto w-full max-w-sm rounded border px-3 py-2 text-sm shadow-lg sm:w-auto ${
              t.kind === 'error'
                ? 'border-red-500/30 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950 dark:text-red-200'
                : 'border-black/10 bg-white text-black dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="break-words">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 text-xs text-current opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
