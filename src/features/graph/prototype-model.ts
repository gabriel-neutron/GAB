/**
 * PROTOTYPE — throwaway. The model the three variants share.
 *
 * It builds the graphology graph, runs the force layout, measures both, and keeps the result in
 * a module-level cache keyed by the entity count.
 *
 * **That cache is half the answer to #35.** The first open pays the layout; every later open —
 * a variant switch, a route re-entry — pays nothing and gets the same picture. A stored position
 * is the same trick, moved from a module variable into a table, and made to survive a reload.
 *
 * The two attribute shapes below are declared, and not left to the graphology default. The
 * default is an index signature of `any`, and a read from it produces an unsafe assignment that
 * this repository permits nobody to suppress.
 */

import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import type { Entity, Proposal, Relation } from '@/shared/fixtures/types';
import { buildPrototypeCorpus, type PrototypeCorpus } from './prototype-data';
import { analyseStructure, type Structure } from './prototype-structure';

export interface NodeAttrs {
  label: string;
  entityType: string;
  x: number;
  y: number;
  size: number;
  color: string;
  baseColor: string;
  degree: number;
  community: number;
  bridge: boolean;
  badged: boolean;
  real: boolean;
}

export interface EdgeAttrs {
  relationType: string;
  size: number;
  color: string;
}

export type CorpusGraph = MultiDirectedGraph<NodeAttrs, EdgeAttrs>;

export interface Cost {
  /** Building the graphology graph from the rows. */
  readonly buildMs: number;
  /** Community detection, cut points and isolates. */
  readonly structureMs: number;
  /** The force layout alone. This is the number #35 is about. */
  readonly layoutMs: number;
  readonly layoutIterations: number;
  readonly totalMs: number;
}

export interface PrototypeModel {
  readonly graph: CorpusGraph;
  readonly corpus: PrototypeCorpus;
  readonly structure: Structure;
  readonly cost: Cost;

  readonly entityById: ReadonlyMap<string, Entity>;
  readonly relationById: ReadonlyMap<string, Relation>;
  /** Relations that the graph draws, by the identifier of either endpoint. */
  readonly drawnByEntity: ReadonlyMap<string, readonly Relation[]>;
  /**
   * M4. A relation with a relation at one end. ADR 0004 §4 keeps it off the graph, so this map
   * is the only way to reach it. Keyed by the identifier of **every** endpoint it names, so a
   * selected entity and a selected relation both find it.
   */
  readonly hiddenByEndpoint: ReadonlyMap<string, readonly Relation[]>;
  readonly hiddenRelations: readonly Relation[];
  /** Pending proposals, by the identifier of the element they name. */
  readonly pendingByTarget: ReadonlyMap<string, readonly Proposal[]>;
  /** Pending proposals that name no existing element, so no badge can carry them. */
  readonly pendingWithoutTarget: readonly Proposal[];
  readonly badgedNodes: readonly string[];
  readonly entityTypes: readonly string[];
}

/**
 * Distinguishable hues for the communities.
 *
 * The result is hexadecimal, and that is not a style choice. Sigma parses a colour on the CPU
 * for the WebGL program, and it reads `#rrggbb` and `rgb()`. It does not read `hsl()`, and a
 * colour it cannot read comes out black — the whole graph, silently.
 */
export function communityColour(index: number): string {
  const hue = ((index * 137.508) % 360) / 360;
  const light = (46 + ((index * 13) % 18)) / 100;
  const saturation = 0.62;

  const c = (1 - Math.abs(2 * light - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue * 6) % 2) - 1));
  const m = light - c / 2;
  const sector = Math.floor(hue * 6) % 6;
  const [r, g, b] =
    sector === 0
      ? [c, x, 0]
      : sector === 1
        ? [x, c, 0]
        : sector === 2
          ? [0, c, x]
          : sector === 3
            ? [0, x, c]
            : sector === 4
              ? [x, 0, c]
              : [c, 0, x];
  const channel = (value: number): string =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export const CUT_POINT_COLOUR = '#e8590c';
export const ISOLATE_COLOUR = '#9aa0a6';

function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function buildModel(targetEntities: number, targetRelations: number): PrototypeModel {
  const startedAll = performance.now();
  const startedBuild = performance.now();

  const corpus = buildPrototypeCorpus(targetEntities, targetRelations);

  const entityById = new Map<string, Entity>();
  for (const entity of corpus.entities) entityById.set(entity.id, entity);

  const relationById = new Map<string, Relation>();
  const drawnByEntity = new Map<string, Relation[]>();
  const hiddenByEndpoint = new Map<string, Relation[]>();
  const hiddenRelations: Relation[] = [];

  const graph: CorpusGraph = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
  for (const entity of corpus.entities) {
    graph.addNode(entity.id, {
      label: entity.label,
      entityType: entity.type,
      x: 0,
      y: 0,
      size: 2,
      color: ISOLATE_COLOUR,
      baseColor: ISOLATE_COLOUR,
      degree: 0,
      community: 0,
      bridge: false,
      badged: false,
      real: corpus.realEntityIds.has(entity.id),
    });
  }

  for (const relation of corpus.relations) {
    relationById.set(relation.id, relation);

    // M4. One end is a relation, so the graph has no node to attach it to.
    if (relation.srcKind === 'relation' || relation.dstKind === 'relation') {
      hiddenRelations.push(relation);
      pushInto(hiddenByEndpoint, relation.srcId, relation);
      pushInto(hiddenByEndpoint, relation.dstId, relation);
      continue;
    }
    if (!graph.hasNode(relation.srcId) || !graph.hasNode(relation.dstId)) continue;

    graph.addDirectedEdgeWithKey(relation.id, relation.srcId, relation.dstId, {
      relationType: relation.type,
      size: 0.6,
      color: '#c9ced6',
    });
    pushInto(drawnByEntity, relation.srcId, relation);
    pushInto(drawnByEntity, relation.dstId, relation);
  }

  const pendingByTarget = new Map<string, Proposal[]>();
  const pendingWithoutTarget: Proposal[] = [];
  for (const proposal of corpus.proposals) {
    if (proposal.status !== 'pending') continue;
    const target = proposal.targetId;
    // The rule the operator chose badges a real element. A proposal that creates something has
    // no real element, so it has nowhere to go. That is the finding, not a defect.
    if (target === null || !(entityById.has(target) || relationById.has(target))) {
      pendingWithoutTarget.push(proposal);
      continue;
    }
    pushInto(pendingByTarget, target, proposal);
  }
  const badgedNodes = [...pendingByTarget.keys()].filter((id) => graph.hasNode(id));

  const buildMs = performance.now() - startedBuild;

  const startedStructure = performance.now();
  const structure = analyseStructure(graph);
  const structureMs = performance.now() - startedStructure;

  // Paint before the layout, so the layout measurement holds nothing else.
  const sizeSpan = Math.max(1, Math.log1p(structure.maxDegree));
  graph.forEachNode((node) => {
    const degree = graph.degree(node);
    const group = structure.community.get(node) ?? 0;
    const isBridge = structure.bridges.has(node);
    const colour =
      degree === 0 ? ISOLATE_COLOUR : isBridge ? CUT_POINT_COLOUR : communityColour(group);
    graph.mergeNodeAttributes(node, {
      size: 1.6 + (Math.log1p(degree) / sizeSpan) * 9,
      color: colour,
      baseColor: colour,
      degree,
      community: group,
      bridge: isBridge,
      badged: pendingByTarget.has(node),
    });
  });

  // A deterministic start. Force Atlas 2 needs a position on every node, and a shared origin
  // gives it nothing to push apart.
  let seedTick = corpus.seed;
  const nextSeeded = (): number => {
    seedTick = (seedTick * 1103515245 + 12345) & 0x7fffffff;
    return seedTick / 0x7fffffff;
  };
  graph.forEachNode((node) => {
    const angle = nextSeeded() * Math.PI * 2;
    const radius = Math.sqrt(nextSeeded()) * 600;
    graph.setNodeAttribute(node, 'x', Math.cos(angle) * radius);
    graph.setNodeAttribute(node, 'y', Math.sin(angle) * radius);
  });

  const layoutIterations = 120;
  const startedLayout = performance.now();
  forceAtlas2.assign(graph, {
    iterations: layoutIterations,
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: graph.order > 1500,
      gravity: 1.2,
      scalingRatio: 12,
      slowDown: 8,
    },
  });
  const layoutMs = performance.now() - startedLayout;

  const entityTypes = [...new Set(corpus.entities.map((e) => e.type))].sort();

  return {
    graph,
    corpus,
    structure,
    cost: {
      buildMs,
      structureMs,
      layoutMs,
      layoutIterations,
      totalMs: performance.now() - startedAll,
    },
    entityById,
    relationById,
    drawnByEntity,
    hiddenByEndpoint,
    hiddenRelations,
    pendingByTarget,
    pendingWithoutTarget,
    badgedNodes,
    entityTypes,
  };
}

const cache = new Map<number, PrototypeModel>();

/** The second call for the same size returns the first result, and the layout is not re-run. */
export function getModel(targetEntities: number): PrototypeModel {
  const existing = cache.get(targetEntities);
  if (existing !== undefined) return existing;
  const built = buildModel(targetEntities, Math.round(targetEntities * 2.5));
  cache.set(targetEntities, built);
  return built;
}

export function isModelCached(targetEntities: number): boolean {
  return cache.has(targetEntities);
}

export interface Stability {
  readonly nodes: number;
  /**
   * Mean movement of a node between two runs, as a fraction of the width of the picture. Both
   * runs are normalised into a unit box first, so this measures the picture and not the scale.
   */
  readonly meanDisplacement: number;
  /**
   * Correlation of the distance between the same pair of nodes across the two runs. Near 1 means
   * the shape survived; the coordinates are a separate question, and `meanDisplacement` answers
   * that one.
   */
  readonly pairDistanceCorrelation: number;
}

/**
 * **The measurement #35 asks for.** Two force layouts of the same graph, from two different
 * starting positions, compared.
 *
 * ADR 0004 §4 states that a force layout is not deterministic and that the picture would change
 * on every open. This puts a number on both halves of it: how far a node moves, and how much of
 * the structure survives the move.
 */
export function measureLayoutStability(targetEntities: number, iterations?: number): Stability {
  const model = getModel(targetEntities);
  const graph = model.graph;
  const nodes = graph.nodes();

  const runFrom = (seed: number): Map<string, { x: number; y: number }> => {
    const copy = graph.copy();
    let tick = seed;
    const next = (): number => {
      tick = (tick * 1103515245 + 12345) & 0x7fffffff;
      return tick / 0x7fffffff;
    };
    copy.forEachNode((node) => {
      const angle = next() * Math.PI * 2;
      const radius = Math.sqrt(next()) * 600;
      copy.setNodeAttribute(node, 'x', Math.cos(angle) * radius);
      copy.setNodeAttribute(node, 'y', Math.sin(angle) * radius);
    });
    forceAtlas2.assign(copy, {
      iterations: iterations ?? model.cost.layoutIterations,
      settings: {
        ...forceAtlas2.inferSettings(copy),
        barnesHutOptimize: copy.order > 1500,
        gravity: 1.2,
        scalingRatio: 12,
        slowDown: 8,
      },
    });

    // Normalise into a unit box, so the comparison is of the picture and not of its scale.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    copy.forEachNode((_node, attrs) => {
      minX = Math.min(minX, attrs.x);
      maxX = Math.max(maxX, attrs.x);
      minY = Math.min(minY, attrs.y);
      maxY = Math.max(maxY, attrs.y);
    });
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const out = new Map<string, { x: number; y: number }>();
    copy.forEachNode((node, attrs) => {
      out.set(node, { x: (attrs.x - minX) / span, y: (attrs.y - minY) / span });
    });
    return out;
  };

  const first = runFrom(0x11111);
  const second = runFrom(0x9e3779b9);

  let total = 0;
  let counted = 0;
  for (const node of nodes) {
    const a = first.get(node);
    const b = second.get(node);
    if (a === undefined || b === undefined) continue;
    total += Math.hypot(a.x - b.x, a.y - b.y);
    counted += 1;
  }

  // A sample of pairs, taken on a fixed stride so the reading repeats.
  const sampleA: number[] = [];
  const sampleB: number[] = [];
  const stride = Math.max(1, Math.floor(nodes.length / 700));
  for (let i = 0; i + stride < nodes.length; i += stride) {
    const left = nodes[i];
    const right = nodes[i + stride];
    if (left === undefined || right === undefined) continue;
    const a1 = first.get(left);
    const a2 = first.get(right);
    const b1 = second.get(left);
    const b2 = second.get(right);
    if (a1 === undefined || a2 === undefined || b1 === undefined || b2 === undefined) continue;
    sampleA.push(Math.hypot(a1.x - a2.x, a1.y - a2.y));
    sampleB.push(Math.hypot(b1.x - b2.x, b1.y - b2.y));
  }

  const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
  const meanA = mean(sampleA);
  const meanB = mean(sampleB);
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let i = 0; i < sampleA.length; i += 1) {
    const da = (sampleA[i] ?? 0) - meanA;
    const db = (sampleB[i] ?? 0) - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }
  const denominator = Math.sqrt(varianceA * varianceB);

  return {
    nodes: counted,
    meanDisplacement: counted === 0 ? 0 : total / counted,
    pairDistanceCorrelation: denominator === 0 ? 0 : covariance / denominator,
  };
}
