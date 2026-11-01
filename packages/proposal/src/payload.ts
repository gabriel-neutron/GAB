import { type AttributeEdit } from './attribute-value.ts';
import { GEOLOCATION_KEY, NOT_STATED, type GeolocationMethod } from './geolocation-method.ts';
import { type WriteRequest } from './request.ts';

// The one document an act of the operator cites. A machine may never cite it, and the database
// refuses one that tries.
const MANUAL = 'manual';

/** One act, in the words `propose_change` reads. The payload keys are those of the jsonb. */
export interface ProposalAct {
  readonly op: WriteRequest['op'];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly src: readonly string[];
  readonly names: readonly string[];
  readonly targetKind: 'entity' | 'relation' | null;
  readonly targetId: string | null;
}

type Sourced = Record<string, { readonly v: AttributeEdit[string]['v']; readonly src: string[] }>;

// The src of an attribute backs that one value alone, and the operator types each value by
// hand. The promotion keeps each document that a kept value already cites.
const sourcedAttributes = (edit: AttributeEdit | undefined): Sourced => {
  const sourced: Sourced = {};
  for (const [key, value] of Object.entries(edit ?? {}))
    sourced[key] = { v: value.v, src: [MANUAL] };
  return sourced;
};

// The place of an act and the method that found it. A place with no method takes `not_stated`, so
// the record never holds a place whose method is unknown to the record.
const placeOf = (request: {
  readonly geom?: unknown;
  readonly geomMethod?: GeolocationMethod | undefined;
}): Record<string, unknown> =>
  request.geom === undefined
    ? {}
    : request.geom === null
      ? { geom: null }
      : { geom: request.geom, [GEOLOCATION_KEY]: request.geomMethod ?? NOT_STATED };

/** The act of the operator, in the words of the record. */
export const proposalAct = (request: WriteRequest): ProposalAct => {
  switch (request.op) {
    case 'create_entity':
      return {
        op: request.op,
        payload: {
          type: request.type,
          label: request.label,
          ...placeOf(request),
          attrs: sourcedAttributes(request.attrs),
          // The row-level list backs label, type and geom alone. The operator types each by
          // hand, so it is manual alone.
          sources: [MANUAL],
        },
        src: [MANUAL],
        names: [],
        targetKind: null,
        targetId: null,
      };

    case 'create_relation':
      return {
        op: request.op,
        payload: {
          type: request.type,
          src_kind: request.srcKind,
          src_id: request.srcId,
          dst_kind: request.dstKind,
          dst_id: request.dstId,
          ...(request.validFrom === undefined ? {} : { valid_from: request.validFrom }),
          ...(request.validTo === undefined ? {} : { valid_to: request.validTo }),
          attrs: sourcedAttributes(request.attrs),
          // The row-level list backs type, the two endpoints and the dates alone. The
          // operator sets each by hand, so it is manual alone.
          sources: [MANUAL],
        },
        src: [MANUAL],
        // The two ends answer "which pending act names this element", which is an indexed read.
        names: [request.srcId, request.dstId],
        targetKind: null,
        targetId: null,
      };

    case 'update_attrs':
      return {
        op: request.op,
        payload: { attrs: sourcedAttributes(request.attrs) },
        src: [MANUAL],
        names: [],
        targetKind: request.targetKind,
        targetId: request.targetId,
      };

    case 'update_relation':
      return {
        op: request.op,
        payload:
          request.addSource === true
            ? { add_source: true }
            : request.type !== undefined
              ? { type: request.type }
              : request.validFrom !== undefined
                ? { valid_from: request.validFrom }
                : { valid_to: request.validTo },
        src: [MANUAL],
        names: [],
        targetKind: 'relation',
        targetId: request.targetId,
      };

    case 'update_entity':
      return {
        op: request.op,
        payload: {
          ...(request.label === undefined ? {} : { label: request.label }),
          ...(request.type === undefined ? {} : { type: request.type }),
          ...placeOf(request),
        },
        // The row-level list backs the name, the type and the place together. The operator
        // authority backs it. If the operator cites a stored image, the citations back it instead.
        src: request.cites === undefined ? [MANUAL] : [...new Set(request.cites)],
        names: [],
        targetKind: 'entity',
        targetId: request.targetId,
      };

    case 'delete_entity':
    case 'delete_relation':
      return {
        op: request.op,
        payload: {},
        src: [MANUAL],
        names: [],
        targetKind: request.op === 'delete_entity' ? 'entity' : 'relation',
        targetId: request.targetId,
      };

    case 'create_observation':
      return {
        op: request.op,
        payload: {
          measure: request.measure,
          value: request.value,
          unit: request.unit,
          period: request.period,
          reporter: request.reporter,
          ...(request.partner === undefined ? {} : { partner: request.partner }),
          method: request.method,
          publisher: request.publisher,
          ...(request.subjectId === undefined ? {} : { subject_id: request.subjectId }),
        },
        src: [MANUAL],
        names: [],
        targetKind: null,
        targetId: null,
      };
  }
};
