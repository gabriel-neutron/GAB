import { proposalAct, type ProposalAct } from './payload.ts';
import { writeRequest } from './request.ts';

// The two documents that only the operator may cite. The database refuses a machine act that
// names one, and the act is refused here first, so the caller reads a sentence and not a
// constraint violation.
const RESERVED = ['manual', 'inherited'] as const;

/** Either the act a machine may propose, or the one sentence that says why none can be made. */
export type MachineDraft =
  | { readonly ready: true; readonly act: ProposalAct }
  | { readonly ready: false; readonly refusal: string };

const refused = (refusal: string): MachineDraft => ({ ready: false, refusal });

const isReserved = (id: string): boolean => RESERVED.some((word) => word === id);

// A reserved word that a kept value held is dropped, never replaced: the documents the caller
// names did not say it, and the act would assert so. Each list is then headed by what it kept.
const recited = (held: readonly string[], cited: readonly string[]): string[] => [
  ...new Set([...held.filter((id) => !isReserved(id)), ...cited]),
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recitedAttributes = (attrs: unknown, cited: readonly string[]): unknown => {
  if (!isRecord(attrs)) return attrs;
  return Object.fromEntries(
    Object.entries(attrs).map(([key, value]) => {
      if (!isRecord(value) || !Array.isArray(value['src'])) return [key, value];
      const held = value['src'].filter((id): id is string => typeof id === 'string');
      return [key, { ...value, src: recited(held, cited) }];
    }),
  );
};

/** The act of a machine. It cites the documents that the caller names and no other. */
export const machineAct = (
  raw: unknown,
  documents: readonly string[],
  prior: unknown,
): MachineDraft => {
  const request = writeRequest.safeParse(raw);
  if (!request.success)
    return refused(request.error.issues.map((issue) => issue.message).join('; '));

  const cited = [...new Set(documents)];
  if (cited.length === 0) return refused('a machine act cites at least one document');
  const reserved = cited.find(isReserved);
  if (reserved !== undefined)
    return refused(`a machine cannot cite the reserved document ${reserved}`);

  const draft = proposalAct(request.data, prior);
  if (!draft.ready) return draft;

  const { act } = draft;
  const attrs = act.payload['attrs'];
  const sources = act.payload['sources'];
  return {
    ready: true,
    act: {
      ...act,
      payload: {
        ...act.payload,
        ...(attrs === undefined ? {} : { attrs: recitedAttributes(attrs, cited) }),
        ...(sources === undefined ? {} : { sources: cited }),
      },
      src: recited(act.src, cited),
    },
  };
};
