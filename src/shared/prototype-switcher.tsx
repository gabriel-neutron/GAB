/**
 * PROTOTYPE — throwaway. The variant bar.
 *
 * A floating pill that cycles the `?variant=` search parameter. It is deliberately unlike the
 * design under it, so that nobody judges it as part of the screen. It renders nothing in a
 * production build, so a stray merge cannot ship it.
 */

import { useEffect } from 'react';

export interface SwitcherOption {
  readonly key: string;
  readonly name: string;
}

export function PrototypeSwitcher({
  options,
  current,
  onChange,
  extra,
}: {
  options: readonly SwitcherOption[];
  current: string;
  onChange: (key: string) => void;
  extra?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      const index = options.findIndex((option) => option.key === current);
      if (index === -1) return;
      const step = event.key === 'ArrowLeft' ? -1 : 1;
      const next = options[(index + step + options.length) % options.length];
      if (next !== undefined) onChange(next.key);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [options, current, onChange]);

  if (import.meta.env.PROD) return null;

  const index = options.findIndex((option) => option.key === current);
  const active = index === -1 ? undefined : options[index];
  const step = (delta: number): void => {
    if (index === -1) return;
    const next = options[(index + delta + options.length) % options.length];
    if (next !== undefined) onChange(next.key);
  };

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-fuchsia-500 bg-zinc-900 px-1.5 py-1 text-zinc-100 shadow-2xl">
      <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">
        prototype
      </span>
      <button
        type="button"
        className="rounded-full px-2 py-0.5 hover:bg-zinc-700"
        onClick={() => {
          step(-1);
        }}
        aria-label="Previous variant"
      >
        ←
      </button>
      <span className="min-w-[190px] text-center text-xs font-medium tabular-nums">
        {active === undefined ? current : `${active.key} — ${active.name}`}
      </span>
      <button
        type="button"
        className="rounded-full px-2 py-0.5 hover:bg-zinc-700"
        onClick={() => {
          step(1);
        }}
        aria-label="Next variant"
      >
        →
      </button>
      {extra === undefined ? null : (
        <span className="ml-1 flex items-center gap-1 border-l border-zinc-700 pl-2">{extra}</span>
      )}
    </div>
  );
}
