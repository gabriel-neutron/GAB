import type { Session, Sessions } from './pool.ts';

const PROPOSAL = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';
const TARGET = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

interface Fault {
  readonly on: string;
  readonly time?: number;
  readonly cause: Error;
}

interface FaultyPool {
  readonly pool: Sessions;
  readonly said: readonly string[];
  readonly releases: () => number;
  readonly proposalId: string;
  readonly targetId: string;
}

const rowsOf = (text: string): Record<string, unknown>[] => {
  if (text.includes('sign_change')) return [{ proposal_id: PROPOSAL, target_id: TARGET }];
  if (text.includes('promote_proposal')) return [{ id: TARGET }];
  return [];
};

export const faultyPool = (faults: readonly Fault[]): FaultyPool => {
  const said: string[] = [];
  let releases = 0;
  const client: Session = {
    query: (text) => {
      said.push(text);
      const time = said.filter((earlier) => earlier === text).length;
      const fault = faults.find((held) => text.includes(held.on) && (held.time ?? 1) === time);
      return fault === undefined
        ? Promise.resolve({ rows: rowsOf(text) })
        : Promise.reject(fault.cause);
    },
    release: () => {
      releases += 1;
    },
  };
  return {
    pool: { connect: () => Promise.resolve(client) },
    said,
    releases: () => releases,
    proposalId: PROPOSAL,
    targetId: TARGET,
  };
};

export const unreachablePool = (): Sessions => ({
  connect: () =>
    Promise.reject(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }),
    ),
});
