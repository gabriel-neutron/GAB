import { useEffect, useState, type RefObject } from 'react';

/** The size of a box in CSS pixels, zero until the first measure. */
export function useSize(box: RefObject<Element | null>): {
  readonly width: number;
  readonly height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });
  // A subscription: the resize observer reports the size of the box.
  useEffect(() => {
    const node = box.current;
    if (node === null) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      const { width, height } = entry.contentRect;
      setSize((old) =>
        Math.round(old.width) === Math.round(width) && Math.round(old.height) === Math.round(height)
          ? old
          : { width, height },
      );
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [box]);
  return size;
}
