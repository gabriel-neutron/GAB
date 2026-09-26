import { z } from 'zod';

import { type AttributeEdit } from './attribute-value.ts';
import { type WriteRequest } from './request.ts';

// The one document an act of the operator cites. A machine may never cite it, and the database
// refuses one that tries.
const MANUAL = 'manual';

const scalar = z.union([z.string(), z.number(), z.boolean()]);

const priorAttributes = z.record(
  z.string(),
  z.looseObject({ v: z.union([scalar, z.array(scalar)]), src: z.array(z.string()) }),
);

/** One act, in the words `propose_change` reads. The payload keys are those of the jsonb. */
export interface ProposalAct {
  readonly op: WriteRequest['op'];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly src: readonly string[];
  readonly names: readonly string[];
  readonly targetKind: 'entity' | 'relation' | null;
  readonly targetId: string | null;
}

/** Either the act to sign, or the one sentence that says why no act can be composed. */
export type ProposalDraft =
  | { readonly ready: true; readonly act: ProposalAct }
  | { readonly ready: false; readonly refusal: string };

type Value = AttributeEdit[string]['v'];

type Sourced = Record<string, { readonly v: Value; readonly src: string[] }>;

type Cited = Record<string, { readonly v: Value; readonly src: readonly string[] }>;

// The database compares the two values as jsonb, where a list keeps its order. Two values that
// differ here differ there too, so the database never refuses a value this file calls changed.
const sameValue = (held: Value, sent: Value): boolean =>
  Array.isArray(held) && Array.isArray(sent)
    ? held.length === sent.length && held.every((element, index) => element === sent[index])
    : held === sent;

// S2: the src of an attribute backs that one value alone. A value the act keeps re-cites its
// documents, and a changed value cites the operator alone. `prior_value` keeps the old claim.
const sourcedAttributes = (edit: AttributeEdit | undefined, before: Cited): Sourced => {
  const sourced: Sourced = {};
  for (const [key, value] of Object.entries(edit ?? {})) {
    const held = before[key];
    const kept = held !== undefined && sameValue(held.v, value.v) ? held.src : [];
    sourced[key] = { v: value.v, src: [...new Set([...kept, MANUAL])] };
  }
  return sourced;
};

const NOTHING: Cited = {};

const citedBy = (sourced: Sourced): string[] => [
  ...new Set([MANUAL, ...Object.values(sourced).flatMap((value) => value.src)]),
];

const UNREADABLE = 'the writer cannot read the attributes the target holds, and it writes nothing';

const drafted = (act: ProposalAct): ProposalDraft => ({ ready: true, act });

// `prior` is what the target row holds today. Read as empty, it would call a kept value changed
// and drop its documents, so a prior that does not parse refuses the request.
export const proposalAct = (request: WriteRequest, prior: unknown): ProposalDraft => {
  switch (request.op) {
    case 'create_entity': {
      const attrs = sourcedAttributes(request.attrs, NOTHING);
      return drafted({
        op: request.op,
        payload: {
          type: request.type,
          label: request.label,
          ...(request.geom === undefined ? {} : { geom: request.geom }),
          attrs,
        },
        src: citedBy(attrs),
        names: [],
        targetKind: null,
        targetId: null,
      });
    }

    case 'create_relation': {
      const attrs = sourcedAttributes(request.attrs, NOTHING);
      return drafted({
        op: request.op,
        payload: {
          type: request.type,
          src_kind: request.srcKind,
          src_id: request.srcId,
          dst_kind: request.dstKind,
          dst_id: request.dstId,
          ...(request.validFrom === undefined ? {} : { valid_from: request.validFrom }),
          ...(request.validTo === undefined ? {} : { valid_to: request.validTo }),
          attrs,
        },
        src: citedBy(attrs),
        // The two ends answer "which pending act names this element", which is an indexed read.
        names: [request.srcId, request.dstId],
        targetKind: null,
        targetId: null,
      });
    }

    case 'update_attrs': {
      const held = priorAttributes.safeParse(prior);
      if (!held.success) return { ready: false, refusal: UNREADABLE };
      const attrs = sourcedAttributes(request.attrs, held.data);
      return drafted({
        op: request.op,
        payload: { attrs },
        src: citedBy(attrs),
        names: [],
        targetKind: request.targetKind,
        targetId: request.targetId,
      });
    }

    case 'update_entity':
      return drafted({
        op: request.op,
        payload: {
          ...(request.label === undefined ? {} : { label: request.label }),
          ...(request.type === undefined ? {} : { type: request.type }),
        },
        src: [MANUAL],
        names: [],
        targetKind: 'entity',
        targetId: request.targetId,
      });

    case 'delete_entity':
      return drafted({
        op: request.op,
        payload: {},
        src: [MANUAL],
        names: [],
        targetKind: 'entity',
        targetId: request.targetId,
      });

    case 'delete_relation':
      return drafted({
        op: request.op,
        payload: {},
        src: [MANUAL],
        names: [],
        targetKind: 'relation',
        targetId: request.targetId,
      });
  }
};
