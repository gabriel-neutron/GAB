import { proposalAct, type ProposalAct } from './payload.ts';
import type { WriteRequest } from './request.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const citedAttributes = (attrs: unknown, cited: readonly string[]): unknown => {
  if (!isRecord(attrs)) return attrs;
  return Object.fromEntries(
    Object.entries(attrs).map(([key, value]) => [
      key,
      isRecord(value) ? { ...value, src: [...cited] } : value,
    ]),
  );
};

/** The act of a machine. It cites the documents that the caller names and no other. The
 * database refuses an act that cites no document or a reserved one, and the promotion keeps the
 * documents that a kept value already cites. */
export const machineAct = (request: WriteRequest, documents: readonly string[]): ProposalAct => {
  const cited = [...new Set(documents)];
  const act = proposalAct(request);
  const attrs = act.payload['attrs'];
  const sources = act.payload['sources'];
  return {
    ...act,
    payload: {
      ...act.payload,
      ...(attrs === undefined ? {} : { attrs: citedAttributes(attrs, cited) }),
      ...(sources === undefined ? {} : { sources: cited }),
    },
    src: cited,
  };
};
