import { z } from 'zod';

import { type AttributeEdit } from './attribute-value.ts';
import { type WriteRequest } from './request.ts';

// The one document an act of the operator cites. A machine may never cite it, and the database
// refuses one that tries.
const MANUAL = 'manual';

const priorAttributes = z.record(z.string(), z.looseObject({ src: z.array(z.string()) }));

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

type Sourced = Record<string, { readonly v: AttributeEdit[string]['v']; readonly src: string[] }>;

type Cited = Record<string, { readonly src: readonly string[] }>;

const sourcedAttributes = (edit: AttributeEdit | undefined, before: Cited): Sourced => {
  const sourced: Sourced = {};
  for (const [key, value] of Object.entries(edit ?? {})) {
    const held = before[key]?.src ?? [];
    sourced[key] = { v: value.v, src: [...new Set([...held, MANUAL])] };
  }
  return sourced;
};

const NOTHING: Cited = {};

const citedBy = (sourced: Sourced): string[] => [
  ...new Set([MANUAL, ...Object.values(sourced).flatMap((value) => value.src)]),
];

const UNREADABLE = 'the writer cannot read the attributes the target holds, and it writes nothing';

const drafted = (act: ProposalAct): ProposalDraft => ({ ready: true, act });

// `prior` is what the target row holds today, and every value the act writes re-cites it: a
// write that drops a document from the sources of a key is refused by the database. A prior
// that does not parse therefore refuses the request, and never becomes an empty citation.
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
