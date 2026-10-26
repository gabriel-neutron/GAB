// The write step of the re-key (spec #958). The dry run plans each pending act with a drifted key.
// This step sends the corrected acts through the propose tool, and only then rejects the old acts.
//
// A group is a set of acts that move together. A new entity has a new id, so each pending act that
// names a re-keyed entity moves with it. The group is sent in at most two batches (the entities and
// the relations first, the places of the new entities after them). Before the first rejection, the
// script checks that each new act waits. A group that the door refuses, or that this script cannot
// rebuild, stays as it is.

import { duplicateIdentifiers, type EntityIdentifiers } from '@gab/tools/duplicate-identifier';
import { propose } from '@gab/tools/propose';
import { callTool, type Session } from '@gab/tools/tool';
import { z } from 'zod';

import { plan, type Attrs, type Plan } from './rekey-attributes.ts';

/** The party that the new acts name as the one who first stated them. */
export const ORIGINATOR = 'script rekey-attributes';

// The propose tool takes 50 items in a batch, and an excerpt of 600 characters.
const MAX_ITEMS = 50;
const MAX_EXCERPT = 600;

export interface Cite {
  readonly document: string;
  readonly page: number;
  /** Null for words read from an image. */
  readonly excerpt: string | null;
  readonly modality: string;
}

/** One pending act, as the database stores it. */
export interface Act {
  readonly id: string;
  readonly op: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly targetId: string | null;
  readonly names: readonly string[];
  /** Null for an act from before the originator was kept. */
  readonly originator: string | null;
  /** The act was disputed already: a value of it was not stated in the excerpt. */
  readonly dissent: boolean;
  readonly cites: readonly Cite[];
}

export interface Group {
  /** The smallest id of the acts that move. */
  readonly key: string;
  /** The acts that the new acts replace: the drifted acts and the acts that name a new entity. */
  readonly moved: readonly Act[];
  /** The entities that wait and that a moved relation names. They are sent again as they are. */
  readonly pass: readonly Act[];
  /** The attributes of the drifted acts, with the canonical keys. */
  readonly attrs: ReadonlyMap<string, Attrs>;
  /** Why the group stays as it is, or null. */
  readonly held: string | null;
}

const attrsOf = (act: Act): Attrs => {
  const held = act.payload['attrs'];
  const parsed = z.record(z.string(), z.looseObject({ v: z.unknown() })).safeParse(held);
  return parsed.success ? parsed.data : {};
};

const SUPPORTED = new Set(['create_entity', 'create_relation', 'update_entity', 'update_attrs']);

const endsOf = (act: Act): string[] =>
  act.op === 'create_relation'
    ? ['src_id', 'dst_id'].flatMap((one) => {
        const end = act.payload[one];
        return typeof end === 'string' ? [end] : [];
      })
    : [];

/** The groups of pending acts to move. `record` holds the entities of the record that carry an
 * identifier, so a drifted entity that copies one of them stays where it is. */
export const groupsOf = (
  acts: readonly Act[],
  record: readonly EntityIdentifiers[] = [],
): Group[] => {
  const byId = new Map(acts.map((one) => [one.id, one] as const));
  const plans = new Map<string, Plan>();
  for (const one of acts) {
    const decided = plan({
      id: one.id,
      attrs: attrsOf(one),
      excerpts: one.cites.flatMap((cite) => (cite.excerpt === null ? [] : [cite.excerpt])),
    });
    if (decided.kind !== 'keep') plans.set(one.id, decided);
  }
  const replaced = new Set([...plans.keys()].filter((id) => byId.get(id)?.op === 'create_entity'));
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const up = parent.get(id) ?? id;
    return up === id ? id : find(up);
  };
  const members = new Set(plans.keys());
  for (const one of acts) {
    const named = [...one.names, ...(one.targetId === null ? [] : [one.targetId])].filter((id) =>
      replaced.has(id),
    );
    for (const id of named) {
      members.add(one.id);
      parent.set(find(one.id), find(id));
    }
  }
  const copies = new Set(
    duplicateIdentifiers([
      ...acts
        .filter((one) => one.op === 'create_entity')
        .map((one) => ({
          id: one.id,
          label: '',
          type: '',
          pending: true,
          attrs: attrsOf(one),
        })),
      ...record,
    ]).flatMap((group) => group.entities.map((one) => one.id)),
  );
  const parts = new Map<string, Act[]>();
  for (const id of members) {
    const one = byId.get(id);
    if (one === undefined) continue;
    const root = find(id);
    parts.set(root, [...(parts.get(root) ?? []), one]);
  }
  return [...parts.values()]
    .map((list) => {
      const moved = [...list].sort((a, b) => a.id.localeCompare(b.id));
      const ids = new Set(moved.map((one) => one.id));
      const pass = new Map<string, Act>();
      const attrs = new Map<string, Attrs>();
      const held = ((): string | null => {
        for (const one of moved) {
          const decided = plans.get(one.id);
          if (decided?.kind === 'hold') return decided.reason;
          if (decided?.kind === 'rekey') attrs.set(one.id, decided.attrs);
          if (one.originator === null) return 'no originator';
          if (!SUPPORTED.has(one.op)) return `the act ${one.op} cannot be sent again`;
          if (one.op === 'update_attrs' && one.targetId !== null && byId.has(one.targetId))
            return 'an attribute update of a new entity cannot be sent';
          if (
            one.op === 'update_entity' &&
            Object.keys(one.payload).some((key) => key !== 'geom' && key !== 'geom_method')
          )
            return 'an update of a new entity holds more than its place';
          if (one.cites.length === 0) return 'an act has no citation';
          if (one.cites.some((cite) => cite.excerpt === null || cite.excerpt.length > MAX_EXCERPT))
            return 'a citation has no excerpt, or an excerpt that is too long';
          if (new Set(one.cites.map((cite) => cite.modality)).size > 1)
            return 'an act cites two modalities';
          if (copies.has(one.id)) return 'the entity copies a duplicate identifier';
          if (acts.some((other) => !ids.has(other.id) && other.names.includes(one.id)))
            return 'an act outside the group names a moved act';
          for (const end of endsOf(one)) {
            if (ids.has(end)) continue;
            const waiting = byId.get(end);
            if (waiting === undefined) continue;
            if (waiting.op !== 'create_entity')
              return 'a relation names a pending act that is no entity';
            if (waiting.originator === null) return 'no originator';
            if (plans.has(end)) return 'a relation names a drifted entity that is not in the group';
            if (copies.has(end)) return 'the entity copies a duplicate identifier';
            pass.set(end, waiting);
          }
        }
        return moved.length + pass.size > MAX_ITEMS
          ? `the group holds more than ${String(MAX_ITEMS)} acts`
          : null;
      })();
      return { key: moved[0]?.id ?? '', moved, pass: [...pass.values()], attrs, held };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
};

const strip = (attrs: Attrs): Record<string, { v: unknown }> =>
  Object.fromEntries(Object.entries(attrs).map(([key, one]) => [key, { v: one.v }]));

type Item = Record<string, unknown>;

const evidenceOf = (one: Act): Item[] =>
  one.cites.map(({ document, page, excerpt }) => ({ document, page, excerpt }));

/** The first batch of a group, and the places that wait for the second. A relation names a new
 * entity by its ref. A place names it by its id, which is known after the first batch. */
export const batchesOf = (
  group: Group,
): {
  readonly first: Item[];
  readonly places: readonly Act[];
  readonly refs: Map<string, string>;
} => {
  const refs = new Map<string, string>();
  const all = [...group.pass, ...group.moved];
  all
    .filter((one) => one.op === 'create_entity')
    .forEach((one, index) => refs.set(one.id, `e${String(index + 1)}`));
  all
    .filter((one) => one.op === 'create_relation' || one.op === 'update_attrs')
    .forEach((one, index) => refs.set(one.id, `r${String(index + 1)}`));
  const item = (one: Act, act: Item): Item => ({
    ref: refs.get(one.id),
    act,
    originator: group.pass.includes(one) ? (one.originator ?? ORIGINATOR) : ORIGINATOR,
    modality: one.cites[0]?.modality,
    evidence: evidenceOf(one),
  });
  const named = (one: Act): Record<string, unknown> => {
    const attrs = strip(group.attrs.get(one.id) ?? attrsOf(one));
    return Object.keys(attrs).length === 0 ? {} : { attrs };
  };
  const method = (one: Act): Record<string, unknown> =>
    one.payload['geom_method'] === undefined ? {} : { geomMethod: one.payload['geom_method'] };
  const end = (id: unknown): unknown => (typeof id === 'string' ? (refs.get(id) ?? id) : id);
  const first: Item[] = [];
  for (const one of all.filter((act) => act.op === 'create_entity'))
    first.push(
      item(one, {
        op: 'create_entity',
        type: one.payload['type'],
        label: one.payload['label'],
        ...(one.payload['geom'] === undefined ? {} : { geom: one.payload['geom'] }),
        ...method(one),
        ...named(one),
      }),
    );
  for (const one of all) {
    const p = one.payload;
    if (one.op === 'create_relation')
      first.push(
        item(one, {
          op: 'create_relation',
          type: p['type'],
          srcKind: p['src_kind'],
          srcId: end(p['src_id']),
          dstKind: p['dst_kind'],
          dstId: end(p['dst_id']),
          ...(p['valid_from'] === undefined ? {} : { validFrom: p['valid_from'] }),
          ...(p['valid_to'] === undefined ? {} : { validTo: p['valid_to'] }),
          ...named(one),
        }),
      );
    else if (one.op === 'update_attrs')
      first.push(
        item(one, {
          op: 'update_attrs',
          targetKind: one.payload['target_kind'] ?? 'entity',
          targetId: one.targetId,
          ...named(one),
        }),
      );
  }
  return { first, places: all.filter((one) => one.op === 'update_entity'), refs };
};

export interface Doors {
  /** Sends one batch. The refusal of the tool comes back as a text. */
  send(
    items: readonly Item[],
  ): Promise<
    | { readonly ok: true; readonly proposals: z.output<typeof answer>['proposals'] }
    | { readonly ok: false; readonly refusal: string }
  >;
  /** How many of these acts wait. */
  waiting(ids: readonly string[]): Promise<number>;
  rejectRelation(id: string, note: string): Promise<void>;
  rejectUnit(id: string, note: string): Promise<void>;
}

export interface Result {
  readonly key: string;
  readonly status: 'done' | 'held' | 'refused';
  readonly reason?: string;
  readonly sent: number;
  readonly rejected: number;
}

const answer = z.object({
  proposals: z.array(
    z.object({
      ref: z.string(),
      proposalId: z.uuid(),
      unstated: z.array(z.string()),
      droppedBounds: z.array(z.string()),
    }),
  ),
});

/** Sends the corrected acts of one group, and then rejects the old acts. */
export const apply = async (group: Group, doors: Doors): Promise<Result> => {
  const stays = (status: 'held' | 'refused', reason: string, sent = 0): Result => ({
    key: group.key,
    status,
    reason,
    sent,
    rejected: 0,
  });
  if (group.held !== null) return stays('held', group.held);
  const { first, places, refs } = batchesOf(group);
  const fresh = new Map<string, string>();
  const weak = new Set<string>();
  const give = async (items: Item[]): Promise<string | null> => {
    const sent = await doors.send(items);
    if (!sent.ok) return sent.refusal;
    for (const one of sent.proposals) {
      fresh.set(one.ref, one.proposalId);
      if (one.unstated.length > 0 || one.droppedBounds.length > 0) weak.add(one.ref);
    }
    return null;
  };
  const refused = await give(first);
  if (refused !== null) return stays('refused', refused);
  const newOf = (id: string): string | undefined => fresh.get(refs.get(id) ?? '');
  const second = places.flatMap((one, index): Item[] => {
    const target = one.targetId === null ? undefined : newOf(one.targetId);
    if (target === undefined) return [];
    refs.set(one.id, `p${String(index + 1)}`);
    return [
      {
        ref: `p${String(index + 1)}`,
        act: {
          op: 'update_entity',
          targetId: target,
          geom: one.payload['geom'],
          ...(one.payload['geom_method'] === undefined
            ? {}
            : { geomMethod: one.payload['geom_method'] }),
        },
        originator: ORIGINATOR,
        modality: one.cites[0]?.modality,
        evidence: evidenceOf(one),
      },
    ];
  });
  if (second.length > 0) {
    const late = await give(second);
    if (late !== null) return stays('refused', late, first.length);
  }
  const sent = first.length + second.length;
  // The check before the first rejection: each new act waits, and each place found its entity.
  const ids = [...new Set(fresh.values())];
  if (second.length !== places.length || (await doors.waiting(ids)) !== ids.length)
    return stays('refused', 'a new act does not wait', sent);
  // Each moved act has a new act, and an entity that is sent as it is comes back with its own id:
  // else a rejection would leave no act, or the queue would hold a second copy.
  if (group.moved.some((one) => newOf(one.id) === undefined))
    return stays('refused', 'the door returned no new act for a moved act', sent);
  if (group.pass.some((one) => newOf(one.id) !== one.id))
    return stays('refused', 'an entity that is right came back as a new copy', sent);
  // A new act that lost a date or a value that the old act held is weaker: the old act stays.
  if (group.moved.some((one) => !one.dissent && weak.has(refs.get(one.id) ?? '')))
    return stays('refused', 'a new act lost a date or a value that no excerpt states', sent);
  const old = group.moved.filter((one) => newOf(one.id) !== one.id);
  const note = (one: Act): string => `re-keyed: replaced by the act ${newOf(one.id) ?? ''}`;
  let rejected = 0;
  try {
    // A relation that joined the unit of an entity is rejected on its own, before the entity.
    for (const one of old.filter((act) => act.op === 'create_relation')) {
      await doors.rejectRelation(one.id, note(one));
      rejected += 1;
    }
    // A place goes with the unit of its entity.
    for (const one of old.filter(
      (act) => act.op !== 'create_relation' && act.op !== 'update_entity',
    )) {
      await doors.rejectUnit(one.id, note(one));
      rejected += 1;
    }
  } catch (cause) {
    // A second run sends the group again (the door writes nothing twice) and ends the rejection.
    return {
      key: group.key,
      status: 'refused',
      reason: `a rejection failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      sent,
      rejected,
    };
  }
  return { key: group.key, status: 'done', sent, rejected };
};

/** The doors of the database. The writer is the role that proposes, and the decider is the role of
 * the operator. */
export const doorsOf = (writer: Session, decider: Session): Doors => ({
  async send(items) {
    const outcome = await callTool(propose, writer, { items });
    return outcome.ok
      ? { ok: true, proposals: answer.parse(outcome.output).proposals }
      : { ok: false, refusal: outcome.refusal };
  },
  async waiting(ids) {
    const { rows } = await decider.query(
      "SELECT count(*)::int AS n FROM public.proposals WHERE id = ANY($1::uuid[]) AND status = 'pending'",
      [ids],
    );
    return z.array(z.object({ n: z.number() })).parse(rows)[0]?.n ?? 0;
  },
  async rejectRelation(id, note) {
    await decider.query('SELECT public.reject_relation($1::uuid, $2, $3, $4)', [
      id,
      'other',
      note,
      ORIGINATOR,
    ]);
  },
  async rejectUnit(id, note) {
    await decider.query('SELECT public.reject_unit($1::uuid, $2, $3, $4)', [
      id,
      'other',
      note,
      ORIGINATOR,
    ]);
  },
});

const actRow = z.strictObject({
  id: z.string(),
  op: z.string(),
  payload: z.record(z.string(), z.unknown()),
  target_id: z.string().nullable(),
  names: z.array(z.string()),
  originator: z.string().nullable(),
  dissent: z.boolean(),
  cites: z.array(
    z.object({
      document: z.string(),
      page: z.number(),
      excerpt: z.string().nullable(),
      modality: z.string(),
    }),
  ),
});

// Every pending act, with the words of its cited spans. A citation of words read from an image has
// no span and so no excerpt.
const READ_ACTS = `SELECT p.id::text AS id, p.op, p.payload, p.target_id::text AS target_id,
    p.names::text[] AS names, p.originator, p.dissent, coalesce(cs.cites, '[]'::json) AS cites
  FROM public.proposals p
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('document', c.doc_id, 'page', c.page, 'modality', c.modality,
             'excerpt', CASE WHEN c.start IS NULL THEN NULL
                             ELSE substr(t.text, c.start + 1, c."end" - c.start) END)
           ORDER BY c.created_at, c.id) AS cites
      FROM public.citation c
      LEFT JOIN public.document_text t ON t.document_id = c.doc_id
                                      AND t.extractor = c.text_extractor AND t.page = c.page
     WHERE c.claim_id = p.id) cs ON true
 WHERE p.status = 'pending'
 ORDER BY p.id`;

const READ_RECORD = `SELECT id::text AS id, label, type, attrs FROM api.entity
  WHERE attrs ?| $1::text[]`;

const recordRow = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
  attrs: z.record(z.string(), z.object({ v: z.unknown() })),
});

/** The groups of the pending queue. `keys` are the unique identifier keys of the record. */
export const readGroups = async (reader: Session, keys: readonly string[]): Promise<Group[]> => {
  const acts = (await reader.query(READ_ACTS, [])).rows.map((one) => actRow.parse(one));
  const record = (await reader.query(READ_RECORD, [[...keys]])).rows.map((one) =>
    recordRow.parse(one),
  );
  return groupsOf(
    acts.map((one) => ({
      id: one.id,
      op: one.op,
      payload: one.payload,
      targetId: one.target_id,
      names: one.names,
      originator: one.originator,
      dissent: one.dissent,
      cites: one.cites,
    })),
    record,
  );
};
