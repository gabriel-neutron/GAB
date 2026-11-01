import { use, useSyncExternalStore, type ReactNode } from 'react';

const waits = new Map<string, Promise<void>>();

/** Resolves when the slot of the part `slug` (report page) comes within one view of the scroll
 * region. */
const near = (slug: string): Promise<void> => {
  let wait = waits.get(slug);
  if (wait === undefined) {
    wait = new Promise<void>((resolve) => {
      const element = document.querySelector(`[data-part="${CSS.escape(slug)}"]`);
      if (element === null) {
        resolve();
        return;
      }
      // The report scrolls in its region and not in the window, and a margin applies to the root.
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          resolve();
        },
        { root: element.closest('[role="region"]'), rootMargin: '100% 0px' },
      );
      observer.observe(element);
    });
    waits.set(slug, wait);
  }
  return wait;
};

const subscribe = () => () => undefined;

/** Hydrates its children only when the slot of the part `slug` (in the HTML of the release) comes
 * near the view. Until then the release HTML stays, with all its text, and the
 * browser does no work for it. A render that is not a hydration draws the children at once. Put it
 * in a `Suspense` boundary. */
export function HydrateNear({
  slug,
  children,
}: {
  readonly slug: string;
  readonly children: ReactNode;
}) {
  // External constraint: React has no flag for a hydration. The server value of a store is used
  // only in the render at the release and in the hydration of its HTML.
  const hydrating = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  if (hydrating && typeof document !== 'undefined') use(near(slug));
  return children;
}
