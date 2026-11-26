import { describe, expect, it } from 'vitest';

import { onlyLoopback, settingsOf, tunnelArgs } from './record-tunnel.ts';

describe('the tunnel of the record', () => {
  const set = settingsOf({ GAB_TUNNEL_SSH: 'auditor@vps.example' });

  it('binds the loopback address of the VPS only, and stops when the forward fails', () => {
    const args = tunnelArgs(set);
    expect(args).toContain('127.0.0.1:15432:127.0.0.1:5432');
    expect(args).toContain('ExitOnForwardFailure=yes');
    expect(args).toContain('BatchMode=yes');
    expect(args.at(-1)).toBe('auditor@vps.example');
  });

  it('refuses a target that is not <user>@<host>, and a port below 1024', () => {
    expect(() => settingsOf({ GAB_TUNNEL_SSH: 'vps.example' })).toThrow(/GAB_TUNNEL_SSH/u);
    expect(() =>
      settingsOf({ GAB_TUNNEL_SSH: 'auditor@vps.example', GAB_TUNNEL_PORT: '80' }),
    ).toThrow();
  });

  it('accepts a listener on 127.0.0.1 only, and refuses no listener or a public one', () => {
    const loopback = 'LISTEN 0      128        127.0.0.1:15432      0.0.0.0:*';
    expect(onlyLoopback(loopback, 15_432)).toBe(true);
    expect(onlyLoopback('', 15_432)).toBe(false);
    expect(onlyLoopback(`${loopback}\nLISTEN 0 128 0.0.0.0:15432 0.0.0.0:*`, 15_432)).toBe(false);
  });
});
