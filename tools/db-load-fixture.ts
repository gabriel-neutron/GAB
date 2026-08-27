// Replays the committed fixture through the four write doors. A promoted act goes through
// gabriel_app and a pending proposal through gabriel_agent, because a trigger stamps the author
// from session_user and the machine, not the operator, authors the candidate layer.

import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { corpus } from '../src/shared/fixtures/corpus.ts';
import type {
  Attributes,
  DocId,
  DocumentRow,
  EndpointKind,
  Point,
  Proposal,
  ProposalPayload,
  Relation,
} from '../src/shared/read/model.ts';

import { connectionString } from './db-runtime.ts';

// The schema seeds this document, so a second insert of it fails on the primary key.
const SEEDED_DOCUMENT = 'manual';

// A decision names who took it. This load is a script, so no screen reads a human decision here.
const DECIDED_BY = 'fixture-loader';

const PUT_DOCUMENT = 'SELECT put_document($1, $2, $3, $4, $5, $6, $7, $8, $9) AS id';
const PROPOSE =
  'SELECT propose_change($1, $2::jsonb, $3::text[], $4, $5, $6::uuid[], $7, $8) AS id';
const PROMOTE = 'SELECT promote_proposal($1, $2) AS id';

interface Act {
  readonly op: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly src: readonly DocId[];
  readonly targetKind: EndpointKind | null;
  readonly targetId: string | null;
  readonly names: readonly string[];
  readonly confidence: number | null;
  readonly dissent: boolean;
}

type Translation = ReadonlyMap<string, string>;

const call = async (client: Client, text: string, values: readonly unknown[]): Promise<string> => {
  const result = await client.query<{ id: string | null }>(text, [...values]);
  const id = result.rows[0]?.id ?? null;
  if (id === null) throw new Error('A write door returned no identifier.');
  return id;
};

const attributeSources = (attrs: Attributes): readonly DocId[] =>
  Object.values(attrs).flatMap((attribute) => [...attribute.src]);

// The proposal must cite every document a value of it cites, or the row is refused.
const citedDocuments = (own: readonly DocId[], attrs: Attributes): readonly DocId[] => [
  ...new Set([...own, ...attributeSources(attrs)]),
];

const asGeoJson = (geom: Point): Readonly<Record<string, unknown>> => ({
  type: 'Point',
  coordinates: [geom.lon, geom.lat],
});

const propose = (client: Client, act: Act): Promise<string> =>
  call(client, PROPOSE, [
    act.op,
    JSON.stringify(act.payload),
    act.src,
    act.targetKind,
    act.targetId,
    act.names,
    act.confidence,
    act.dissent,
  ]);

const promote = (client: Client, proposalId: string): Promise<string> =>
  call(client, PROMOTE, [proposalId, DECIDED_BY]);

const named = (label: string, error: unknown): Error =>
  new Error(`The row "${label}" was refused by the database.`, { cause: error });

// The fixture carries no object key and no media type, so both stay empty.
const loadDocument = async (client: Client, row: DocumentRow): Promise<void> => {
  try {
    await call(client, PUT_DOCUMENT, [
      row.id,
      row.kind,
      row.title,
      null,
      row.uri,
      row.archiveUri,
      row.sha256,
      null,
      row.retrievedAt,
    ]);
  } catch (error) {
    throw named(row.title, error);
  }
};

const loadDocuments = async (client: Client): Promise<number> => {
  const rows = corpus.documents.filter((row) => row.id !== SEEDED_DOCUMENT);
  for (const row of rows) await loadDocument(client, row);
  return rows.length;
};

const loadEntities = async (client: Client): Promise<Translation> => {
  const ids = new Map<string, string>();
  for (const entity of corpus.entities) {
    try {
      const proposalId = await propose(client, {
        op: 'create_entity',
        payload: {
          type: entity.type,
          label: entity.label,
          attrs: entity.attrs,
          ...(entity.geom === null ? {} : { geom: asGeoJson(entity.geom) }),
        },
        src: citedDocuments(entity.sources, entity.attrs),
        targetKind: null,
        targetId: null,
        names: [],
        confidence: null,
        dissent: false,
      });
      ids.set(entity.id, await promote(client, proposalId));
    } catch (error) {
      throw named(entity.label, error);
    }
  }
  return ids;
};

const endpointId = (
  kind: EndpointKind,
  fixtureId: string,
  entities: Translation,
  relations: Translation,
): string | undefined => (kind === 'entity' ? entities.get(fixtureId) : relations.get(fixtureId));

const loadRelation = async (
  client: Client,
  relation: Relation,
  srcId: string,
  dstId: string,
): Promise<string> => {
  const proposalId = await propose(client, {
    op: 'create_relation',
    payload: {
      type: relation.type,
      src_kind: relation.srcKind,
      src_id: srcId,
      dst_kind: relation.dstKind,
      dst_id: dstId,
      attrs: relation.attrs,
      ...(relation.validFrom === null ? {} : { valid_from: relation.validFrom }),
      ...(relation.validTo === null ? {} : { valid_to: relation.validTo }),
    },
    src: citedDocuments(relation.sources, relation.attrs),
    targetKind: null,
    targetId: null,
    names: [srcId, dstId],
    confidence: null,
    dissent: false,
  });
  return promote(client, proposalId);
};

// An endpoint of a relation may be another relation, and that one must exist first. A pass
// that places nothing leaves a cycle or a missing endpoint, and it stops the load.
const loadRelations = async (client: Client, entities: Translation): Promise<Translation> => {
  const ids = new Map<string, string>();
  let waiting = [...corpus.relations];

  while (waiting.length > 0) {
    const deferred: Relation[] = [];
    for (const relation of waiting) {
      const srcId = endpointId(relation.srcKind, relation.srcId, entities, ids);
      const dstId = endpointId(relation.dstKind, relation.dstId, entities, ids);
      if (srcId === undefined || dstId === undefined) {
        deferred.push(relation);
        continue;
      }
      try {
        ids.set(relation.id, await loadRelation(client, relation, srcId, dstId));
      } catch (error) {
        throw named(`${relation.type} ${relation.id}`, error);
      }
    }
    if (deferred.length === waiting.length) {
      const missing = deferred.map((relation) => relation.id).join(', ');
      throw new Error(`No endpoint exists for these relations, and the load stopped: ${missing}`);
    }
    waiting = deferred;
  }
  return ids;
};

const candidateAttributes = (payload: ProposalPayload): Attributes =>
  payload.kind === 'entity' || payload.kind === 'attrs' ? payload.attrs : {};

const candidatePayload = (
  payload: ProposalPayload,
  entities: Translation,
): Readonly<Record<string, unknown>> => {
  switch (payload.kind) {
    case 'entity':
      return { type: payload.type, label: payload.label, attrs: payload.attrs };
    case 'attrs':
      return { attrs: payload.attrs };
    case 'relation': {
      const srcId = payload.src_id === null ? undefined : entities.get(payload.src_id);
      const dstId = payload.dst_id === null ? undefined : entities.get(payload.dst_id);
      if (srcId === undefined || dstId === undefined) {
        throw new Error('A candidate relation names an endpoint that the fixture does not hold.');
      }
      return {
        type: payload.type,
        src_kind: 'entity',
        src_id: srcId,
        dst_kind: 'entity',
        dst_id: dstId,
      };
    }
    // A merge and a delete have no agreed payload shape, so neither is written.
    case 'merge':
    case 'delete':
      throw new Error(`A ${payload.kind} candidate has no agreed payload shape.`);
  }
};

const candidateNames = (payload: Readonly<Record<string, unknown>>): readonly string[] => {
  const srcId = payload['src_id'];
  const dstId = payload['dst_id'];
  return typeof srcId === 'string' && typeof dstId === 'string' ? [srcId, dstId] : [];
};

const candidateTarget = (
  proposal: Proposal,
  entities: Translation,
  relations: Translation,
): string | null => {
  if (proposal.targetKind === null || proposal.targetId === null) return null;
  const targetId = endpointId(proposal.targetKind, proposal.targetId, entities, relations);
  if (targetId === undefined) {
    throw new Error('A candidate names a target that the fixture does not hold.');
  }
  return targetId;
};

// The candidate layer. These stay pending, and the connection stamps them as gabriel_agent.
const loadCandidates = async (
  client: Client,
  entities: Translation,
  relations: Translation,
): Promise<number> => {
  const pending = corpus.proposals.filter((proposal) => proposal.status === 'pending');
  for (const proposal of pending) {
    try {
      const payload = candidatePayload(proposal.payload, entities);
      const targetId = candidateTarget(proposal, entities, relations);
      await propose(client, {
        op: proposal.op,
        payload,
        src: citedDocuments(proposal.src, candidateAttributes(proposal.payload)),
        targetKind: targetId === null ? null : proposal.targetKind,
        targetId,
        names: candidateNames(payload),
        confidence: proposal.confidence,
        dissent: proposal.dissent,
      });
    } catch (error) {
      throw named(`${proposal.op} ${proposal.id}`, error);
    }
  }
  return pending.length;
};

export const main = async (): Promise<void> => {
  const operator = new Client({ connectionString: connectionString('app') });
  const machine = new Client({ connectionString: connectionString('agent') });
  await operator.connect();
  await machine.connect();
  try {
    const documents = await loadDocuments(operator);
    const entities = await loadEntities(operator);
    const relations = await loadRelations(operator, entities);
    const candidates = await loadCandidates(machine, entities, relations);

    console.log(`documents  ${documents}`);
    console.log(`entities   ${entities.size}`);
    console.log(`relations  ${relations.size}`);
    console.log(`candidates ${candidates}`);
  } finally {
    await operator.end();
    await machine.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
