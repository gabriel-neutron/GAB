import { use, type ReactNode } from 'react';
import { useReleaseRender } from './release-render';

const waits = new Map<string, Promise<void>>();

/** Resolves when the slot of the part `slug` comes within one view of the scroll region, or at the
 * first touch, click or focus in it. */
const near = (slug: string): Promise<void> => {
  let wait = waits.get(slug);
  if (wait === undefined) {
    wait = new Promise<void>((resolve) => {
      const element = document.querySelector(`[data-part="${CSS.escape(slug)}"]`);
      if (element === null) {
        resolve();
        return;
      }
      // React replays a click on a waiting part when the part hydrates.
      const EVENTS = ['pointerdown', 'focusin', 'keydown'] as const;
      const done = () => {
        observer.disconnect();
        for (const name of EVENTS) element.removeEventListener(name, done, true);
        resolve();
      };
      // The report scrolls in its region and not in the window, and a margin applies to the root.
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) done();
        },
        { root: element.closest('[role="region"]'), rootMargin: '100% 0px' },
      );
      observer.observe(element);
      for (const name of EVENTS) element.addEventListener(name, done, true);
    });
    waits.set(slug, wait);
  }
  return wait;
};

/** Hydrates its children only when the slot of the part `slug` (in the HTML of the release) comes
 * near the view. Until then the release HTML stays, with all its text, and the browser does no work
 * for it. A render that is not a hydration draws the children at once. Put it in a `Suspense`
 * boundary. */
export function HydrateNear({
  slug,
  children,
}: {
  readonly slug: string;
  readonly children: ReactNode;
}) {
  if (useReleaseRender() && typeof document !== 'undefined') use(near(slug));
  return children;
}
