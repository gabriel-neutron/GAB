// The secret file of the tunnel to the VPS: tools/record-tunnel.ts writes it on the VPS, and
// `pnpm node:audit --record --tunnel <file>` reads it there. It holds the one secret of the VPS: the
// password of gabriel_audit for one tunnel. Run book: infra/vps/README.md, "The record through the
// tunnel".

import { parseEnv } from 'node:util';

import { z } from 'zod';

export const AUDIT_ROLE = 'gabriel_audit';

/** The text of the file. The tunnel binds the loopback address of the VPS only. */
export const tunnelEnvText = (password: string, port: number): string =>
  [
    '# Written by tools/record-tunnel.ts on the PC. The password stops when the tunnel closes.',
    `GABRIEL_AUDIT_PASSWORD=${password}`,
    'GABRIEL_DB_HOST=127.0.0.1',
    `GABRIEL_DB_PORT=${port}`,
    'GABRIEL_DATABASE=gabriel',
    '',
  ].join('\n');

const held = z.object({
  GABRIEL_AUDIT_PASSWORD: z.string().regex(/^[0-9a-f]{32,}$/u),
  GABRIEL_DB_HOST: z.literal('127.0.0.1'),
  GABRIEL_DB_PORT: z.coerce.number().int().min(1024).max(65_535),
  GABRIEL_DATABASE: z.literal('gabriel'),
});

/** The address of the record through the tunnel, as gabriel_audit. A file that does not hold the
 * four values of tunnelEnvText() stops the run: there is no other role to fall back to. */
export const tunnelConnection = (text: string): string => {
  const found = held.safeParse(parseEnv(text));
  if (!found.success)
    throw new Error(
      'The tunnel file does not hold GABRIEL_AUDIT_PASSWORD, GABRIEL_DB_HOST=127.0.0.1, ' +
        'GABRIEL_DB_PORT and GABRIEL_DATABASE=gabriel. Open the tunnel again on the PC.',
    );
  const { GABRIEL_AUDIT_PASSWORD, GABRIEL_DB_PORT } = found.data;
  return `postgresql://${AUDIT_ROLE}:${GABRIEL_AUDIT_PASSWORD}@127.0.0.1:${GABRIEL_DB_PORT}/gabriel`;
};
