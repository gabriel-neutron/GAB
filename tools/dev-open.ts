// The address that `pnpm dev` opens. It holds the key of the operator, so a command other than
// `pnpm dev` must never get it. Never use `define` or index.html for the key, because the
// development server gives both to any caller.

import { parseEnv } from 'node:util';

const BYTE_ORDER_MARK = '\uFEFF';

/** The key of the operator in the text of `infra/.env`, or nothing when it is absent or blank. */
export const operatorKeyIn = (text: string | undefined): string | undefined => {
  if (text === undefined) return undefined;
  // Notepad can save the file with a byte order mark.
  const bare = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const key = parseEnv(bare)['GABRIEL_OPERATOR_KEY']?.trim();
  return key === undefined || key === '' ? undefined : key;
};

/** The page to open: the key goes in the fragment, which no server receives, and only for
 * `pnpm dev`, so Storybook, preview and Vitest open no browser. */
export const openWithKey = (
  envText: string | undefined,
  lifecycle: string | undefined,
): string | false => {
  const key = operatorKeyIn(envText);
  return key !== undefined && lifecycle === 'dev' ? `/#operator-key=${key}` : false;
};
