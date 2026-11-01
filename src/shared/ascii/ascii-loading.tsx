import { useEffect, useRef } from 'react';
import { statusOrb } from 'asciify-engine/kit';

/** The loading mark of a page: characters that orbit while the page loads. The word stays HTML,
 * and it is the live region a screen reader hears. */
export function AsciiLoading() {
  const slot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (slot.current === null) return undefined;
    const orb = statusOrb(slot.current, { ring: true, colourByState: false });
    orb.loading();
    return () => {
      orb.destroy();
    };
  }, []);

  return (
    <p role="status" className="flex items-center gap-3 font-mono text-data uppercase">
      <span ref={slot} aria-hidden="true" className="inline-block size-10" />
      Loading
    </p>
  );
}
