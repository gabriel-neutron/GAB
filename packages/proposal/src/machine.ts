import { proposalAct, type ProposalAct } from './payload.ts';
import { writeRequest } from './request.ts';

/** Either the act a machine may propose, or the one sentence that says why none can be made. */
export type MachineDraft =
  | { readonly ready: true; readonly act: ProposalAct }
  | { readonly ready: false; readonly refusal: string };

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
export const machineAct = (raw: unknown, documents: readonly string[]): MachineDraft => {
  const request = writeRequest.safeParse(raw);
  if (!request.success)
    return { ready: false, refusal: request.error.issues.map((issue) => issue.message).join('; ') };

  const cited = [...new Set(documents)];
  const act = proposalAct(request.data);
  const attrs = act.payload['attrs'];
  const sources = act.payload['sources'];
  return {
    ready: true,
    act: {
      ...act,
      payload: {
        ...act.payload,
        ...(attrs === undefined ? {} : { attrs: citedAttributes(attrs, cited) }),
        ...(sources === undefined ? {} : { sources: cited }),
      },
      src: cited,
    },
  };
};
