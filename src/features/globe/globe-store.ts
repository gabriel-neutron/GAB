import type { ProductKey } from '@gab/proposal/chain-product';

/** What a card can be about: an entity, a physical link, or an exit point. */
export interface Target {
  readonly kind: 'entity' | 'arc' | 'exit';
  readonly id: string;
}

/** One of several features under one click. The reader picks one. */
export interface Choice {
  readonly target: Target;
  readonly label: string;
}

export type Panel =
  | { readonly kind: 'none' }
  | { readonly kind: 'target'; readonly target: Target }
  | { readonly kind: 'choice'; readonly choices: readonly Choice[] };

export interface GlobeState {
  readonly panel: Panel;
  readonly product: ProductKey | 'all';
  /** The key of the step in view, or null. */
  readonly step: string | null;
  /** The chain goes to the next step by itself. */
  readonly playing: boolean;
  /** False when the reader stopped the motion or asked the system for none. */
  readonly moving: boolean;
  /** False when the browser cannot draw the globe. */
  readonly available: boolean;
}

export interface GlobeStore {
  readonly get: () => GlobeState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly select: (target: Target | null) => void;
  readonly choose: (choices: readonly Choice[]) => void;
  readonly setProduct: (product: ProductKey | 'all') => void;
  readonly setStep: (key: string | null) => void;
  /** One press of "Next step": the step after the one in view, and the first after the last. */
  readonly next: () => void;
  readonly togglePlay: () => void;
  /** The reader acted on the globe: the chain stops going to the next step by itself. */
  readonly stopPlay: () => void;
  /** Stops each motion that starts by itself, for the rest of the visit. */
  readonly stopMotion: () => void;
  readonly setUnavailable: () => void;
  /** Stops the timer. */
  readonly dispose: () => void;
}

export interface GlobeStoreOptions {
  /** The keys of the steps, in order. */
  readonly steps: readonly string[];
  /** True when the reader asked the system for no motion. */
  readonly still: boolean;
  /** The entity that the address names, or null. */
  readonly entity: string | null;
}

// Origin of the number: a camera jump is under 120 ms, so the reader needs about five seconds to
// read the sentence of a step before the next one comes.
export const STEP_TIME = 5000;

export function createGlobeStore({ steps, still, entity }: GlobeStoreOptions): GlobeStore {
  let state: GlobeState = {
    panel:
      entity === null
        ? { kind: 'none' }
        : { kind: 'target', target: { kind: 'entity', id: entity } },
    product: 'all',
    step: null,
    playing: false,
    moving: !still,
    available: true,
  };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const set = (patch: Partial<GlobeState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };
  const stopTimer = (): void => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const stopPlay = (): void => {
    stopTimer();
    if (state.playing) set({ playing: false });
  };
  const advance = (): void => {
    const here = state.step === null ? -1 : steps.indexOf(state.step);
    set({ panel: { kind: 'none' }, step: steps[here + 1] ?? steps[0] ?? null });
  };

  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select: (target) => {
      stopPlay();
      set(
        target === null
          ? { panel: { kind: 'none' } }
          : { panel: { kind: 'target', target }, step: null },
      );
    },
    choose: (choices) => {
      stopPlay();
      set({ panel: { kind: 'choice', choices } });
    },
    setProduct: (product) => {
      stopPlay();
      set({ product, panel: { kind: 'none' } });
    },
    setStep: (key) => {
      stopPlay();
      set({ step: key, panel: { kind: 'none' } });
    },
    next: () => {
      stopPlay();
      advance();
    },
    togglePlay: () => {
      if (!state.moving) {
        stopPlay();
        advance();
        return;
      }
      if (state.playing) {
        stopPlay();
        return;
      }
      advance();
      timer = setInterval(advance, STEP_TIME);
      set({ playing: true });
    },
    stopPlay,
    stopMotion: () => {
      stopPlay();
      if (state.moving) set({ moving: false });
    },
    setUnavailable: () => {
      stopPlay();
      set({ available: false });
    },
    dispose: stopTimer,
  };
}
