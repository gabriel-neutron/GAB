// The key of the operator. `pnpm dev` opens the page with the key in the address fragment, which
// no server receives. The page keeps the key in the storage of its own origin, port included, and
// sends it with every request to the writer.

import { OPERATOR_KEY_HEADER } from '@gab/proposal/request';

const STORAGE_NAME = 'gab-operator-key';
const FRAGMENT = /^#operator-key=([A-Za-z0-9_-]{32,})$/u;

/** Keep the key of the address fragment, and remove the fragment from the address. Call it before
 * the router reads the address. Blocked storage, or no browser, keeps nothing and raises nothing. */
export function keepOperatorKey(): void {
  try {
    const key = FRAGMENT.exec(location.hash)?.[1];
    if (key === undefined) return;
    try {
      localStorage.setItem(STORAGE_NAME, key);
    } finally {
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch {
    // Storage can be blocked, and node has no window: the page then sends no key.
  }
}

/** The header that carries the key of the operator, or no header when the page holds no key. */
export function operatorHeader(): Record<string, string> {
  try {
    const key = localStorage.getItem(STORAGE_NAME);
    return key === null || key === '' ? {} : { [OPERATOR_KEY_HEADER]: key };
  } catch {
    return {};
  }
}
