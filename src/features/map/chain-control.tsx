import type { ChainStep } from '@gab/proposal/chain-steps';
import { useState, type RefObject } from 'react';

import type { MapHandle } from './adapter';
import { ChainStrip, type ChainAct } from './chain-strip';

interface ChainControlProps {
  readonly map: RefObject<MapHandle | null>;
  readonly steps: readonly ChainStep[];
}

// The mode and the projection mirror the handle, which is the store. The step is a state of the
// view: it dies with the map, as a hover does.
export function ChainControl({ map, steps }: ChainControlProps) {
  const [chain, setChain] = useState(() => map.current?.chain ?? false);
  const [globe, setGlobe] = useState(() => map.current?.globe ?? false);
  const [step, setStep] = useState<string | null>(null);

  const act = (next: ChainAct): void => {
    const live = map.current;
    if (live === null) return;
    switch (next.kind) {
      case 'switch-chain':
        live.setChain(next.on);
        setChain(live.chain);
        if (!next.on) setStep(null);
        return;
      case 'switch-globe':
        live.setGlobe(next.on);
        setGlobe(live.globe);
        return;
      case 'show-step':
        live.showStep(next.key);
        setStep(next.key);
        return;
    }
  };

  return <ChainStrip steps={steps} state={{ chain, globe, step }} onAct={act} />;
}
