/**
 * PROTOTYPE — throwaway. Delete this folder when the question is answered.
 *
 * Three variants of the graph view on `/graph`, switched by `?variant=`. This file holds the
 * data the three share: the real fixture, and a **seeded inflater** that grows it to the volume
 * ADR 0004 §4 names — about 10k entities and 25k relations.
 *
 * The inflater exists for one reason. #35 asks what a browser layout costs. Five entities cannot
 * answer that. Every synthetic row is invented, deterministic from a fixed seed, and marked, so
 * a reader can tell the five real rows from the ten thousand made-up ones.
 *
 * **Nothing here settles an open question.** The synthetic rows are shaped like the guess in
 * `src/shared/fixtures/types.ts`, and that file says what it is.
 */

import { corpus } from '@/shared/fixtures/corpus';
import type { Attributes, Entity, Proposal, Relation } from '@/shared/fixtures/types';

/** A deterministic generator. The same seed gives the same corpus on every open. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `noUncheckedIndexedAccess` is on. A prototype reads an index it built, so this throws. */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) throw new Error(`index ${index} is out of range`);
  return value;
}

const ENTITY_TYPES = ['company', 'vessel', 'facility', 'person'] as const;
const RELATION_TYPES = [
  'owns',
  'appoints',
  'berthed_at',
  'operates',
  'supplies',
  'controls',
] as const;

const NO_ATTRS: Attributes = {};
const SYNTHETIC_SOURCES: readonly string[] = ['doc_8f2a41'];

export interface PrototypeCorpus {
  readonly entities: readonly Entity[];
  /** Every relation, including the M4 ones that the graph must not draw. */
  readonly relations: readonly Relation[];
  readonly proposals: readonly Proposal[];
  /** The five rows that came from the fixture. Everything else is invented. */
  readonly realEntityIds: ReadonlySet<string>;
  readonly realRelationIds: ReadonlySet<string>;
  readonly realProposalIds: ReadonlySet<string>;
  /** The community each entity was generated into. Ground truth, for nothing but a sanity read. */
  readonly plantedCommunity: ReadonlyMap<string, number>;
  readonly seed: number;
}

const SEED = 0x6ab21e;

/**
 * Grows the fixture to `targetEntities` / `targetRelations`.
 *
 * The shape is chosen so that the three things the analyst hunts for are all present and all
 * findable: dense communities, a small number of single-edge bridges between them, and a tail
 * of isolates. A preferential-attachment tree inside each community produces the hubs and the
 * cut points; the extra intra-community edges then destroy some of them, which is what a real
 * corpus does too.
 */
export function buildPrototypeCorpus(
  targetEntities: number,
  targetRelations: number,
): PrototypeCorpus {
  const rand = mulberry32(SEED);

  const entities: Entity[] = [...corpus.entities];
  const relations: Relation[] = [...corpus.relations];
  const proposals: Proposal[] = [...corpus.proposals];

  const realEntityIds = new Set(corpus.entities.map((e) => e.id));
  const realRelationIds = new Set(corpus.relations.map((r) => r.id));
  const realProposalIds = new Set(corpus.proposals.map((p) => p.id));

  const plantedCommunity = new Map<string, number>();
  for (const entity of corpus.entities) plantedCommunity.set(entity.id, 0);

  // About one community per hundred entities, and never fewer than six.
  const communityCount = Math.max(6, Math.round(Math.sqrt(targetEntities) / 4));
  const members: string[][] = Array.from({ length: communityCount }, (): string[] => []);
  for (const entity of corpus.entities) at(members, 0).push(entity.id);

  // --- entities ---------------------------------------------------------------------------
  for (let i = entities.length; i < targetEntities; i += 1) {
    const id = `syn-e-${i}`;
    const type = at(ENTITY_TYPES, Math.floor(rand() * ENTITY_TYPES.length));
    // A skewed draw, so the communities differ in size the way real ones do.
    const community = Math.min(
      communityCount - 1,
      Math.floor(communityCount * Math.pow(rand(), 1.7)),
    );
    entities.push({
      id,
      type,
      label: `${type} ${i}`,
      attrs: NO_ATTRS,
      sources: SYNTHETIC_SOURCES,
      geom: null,
      promotedFrom: `syn-p-${i}`,
    });
    plantedCommunity.set(id, community);
    at(members, community).push(id);
  }

  // --- relations --------------------------------------------------------------------------
  let edgeCount = 0;
  const pushEdge = (srcId: string, dstId: string): void => {
    relations.push({
      id: `syn-r-${edgeCount}`,
      type: at(RELATION_TYPES, Math.floor(rand() * RELATION_TYPES.length)),
      srcKind: 'entity',
      srcId,
      dstKind: 'entity',
      dstId,
      attrs: NO_ATTRS,
      sources: SYNTHETIC_SOURCES,
      validFrom: null,
      validTo: null,
      promotedFrom: `syn-p-r-${edgeCount}`,
    });
    edgeCount += 1;
  };

  // A degree-weighted bag: each identifier appears once per edge it already carries.
  const bag: string[] = [];

  for (const group of members) {
    if (group.length === 0) continue;
    const local: string[] = [at(group, 0)];
    for (let k = 1; k < group.length; k += 1) {
      const id = at(group, k);
      // A tail of isolates. The map shows them, and they are one of the three macro reads.
      if (rand() < 0.015) continue;
      const anchor =
        local.length > 4 && rand() < 0.75
          ? at(local, Math.floor(Math.pow(rand(), 2) * local.length))
          : at(local, Math.floor(rand() * local.length));
      pushEdge(anchor, id);
      bag.push(anchor, id);
      local.push(id);
    }
  }

  // One single edge between each pair of neighbouring communities. Each end of such an edge is
  // an articulation point, which is exactly the bridge the analyst hunts for.
  for (let c = 1; c < communityCount; c += 1) {
    const left = at(members, c - 1);
    const right = at(members, c);
    if (left.length === 0 || right.length === 0) continue;
    const a = at(left, Math.floor(rand() * left.length));
    const b = at(right, Math.floor(rand() * right.length));
    pushEdge(a, b);
    bag.push(a, b);
  }

  // Top up with intra-community edges until the relation count is reached. These raise the
  // density and remove some cut points, so the survivors mean something.
  let guard = 0;
  while (relations.length < targetRelations && guard < targetRelations * 4) {
    guard += 1;
    const group = at(members, Math.floor(rand() * communityCount));
    if (group.length < 3) continue;
    const a = bag.length > 0 && rand() < 0.6 ? at(bag, Math.floor(rand() * bag.length)) : null;
    const src = a ?? at(group, Math.floor(rand() * group.length));
    const dst = at(group, Math.floor(rand() * group.length));
    if (src === dst) continue;
    if (plantedCommunity.get(src) !== plantedCommunity.get(dst)) continue;
    pushEdge(src, dst);
    bag.push(src, dst);
  }

  // --- proposals --------------------------------------------------------------------------
  // Synthetic pending proposals, so the badge layer of #10 is tested at volume and not on one
  // row. They are all `update_attrs` on an existing entity, which is the only operation the
  // chosen rule can draw at all.
  const syntheticProposals = Math.round(targetEntities * 0.004);
  for (let i = 0; i < syntheticProposals; i += 1) {
    const target = at(entities, Math.floor(rand() * entities.length));
    proposals.push({
      id: `syn-pr-${i}`,
      op: 'update_attrs',
      targetKind: 'entity',
      targetId: target.id,
      payload: { kind: 'attrs', attrs: { throughput_t: { v: 1000 + i, src: ['doc_8f2a41'] } } },
      src: ['doc_8f2a41'],
      confidence: 0.4 + rand() * 0.55,
      dissent: rand() < 0.3,
      authorRole: 'gabriel_agent',
      status: 'pending',
      callId: `syn-ca-${i}`,
      createdAt: '2026-08-06T00:00:00Z',
      decidedAt: null,
      decidedBy: null,
    });
  }

  return {
    entities,
    relations,
    proposals,
    realEntityIds,
    realRelationIds,
    realProposalIds,
    plantedCommunity,
    seed: SEED,
  };
}
