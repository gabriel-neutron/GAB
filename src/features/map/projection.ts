/**
 * The corpus, reduced to what a map can draw.
 *
 * Built from `docs/map-surface.md` §4.1 and §4.6. It is the one place that decides what "on the
 * map" means, and every other component of the surface reads it.
 *
 * **It holds no state and it reads no module.** It takes the read as an argument, so the day
 * `src/contract/` exists the caller changes and this file does not. `spec.md` §4 puts the read
 * behind a view; until then the caller passes the fixture of #46.
 */

import type { Attributes, Corpus, Entity, Point } from '@/shared/fixtures/types';

/**
 * One entity that carries a geometry, flattened for the renderer.
 *
 * **Two identifiers, and they are not the same thing.** MapLibre wants a number for a feature
 * identifier, and `fid` is a position in the array below. The identity of the row is `id`, and
 * that is what the address of the route carries. Both lookups are kept.
 */
export interface GeoEntity {
  readonly fid: number;
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly lon: number;
  readonly lat: number;
  readonly sources: readonly string[];
  /** M7 and M8: a value, and the documents that carry it. The index rows read these. */
  readonly attrs: Attributes;
}

/**
 * One relation whose **two** endpoints carry a geometry, so a line can be drawn for it.
 *
 * M4 permits a relation to point at another relation. Such a relation has no second point, so it
 * is not here — ADR 0004 §4 says the same of the graph, and it is reached through the detail
 * surface instead.
 */
export interface GeoLink {
  readonly fid: number;
  readonly id: string;
  readonly type: string;
  readonly from: GeoEntity;
  readonly to: GeoEntity;
  readonly sources: readonly string[];
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly attrs: Attributes;
}

/** One entity type, as the rail draws it. */
export interface TypeFacet {
  readonly type: string;
  readonly colour: string;
  readonly count: number;
  /**
   * The attribute key that the most entities of this type carry, ties broken by the alphabet.
   * `null` when the type carries no attribute at all.
   *
   * ADR 0005 §6 forbids a hand-kept table of "the key that matters for a vessel", so the rule is
   * machine-derived and stays that way. `docs/map-surface.md` §3.2 measures what it gives, and
   * records that one type of four does not share a key at all. That is #12, and this file does
   * not answer it: it reports the key and the count that carry it.
   */
  readonly key: string | null;
  /** How many entities of this type carry `key`. The rail says so when it is not all of them. */
  readonly keyCount: number;
}

export interface Projection {
  readonly entities: readonly GeoEntity[];
  readonly byFid: ReadonlyMap<number, GeoEntity>;
  readonly byId: ReadonlyMap<string, GeoEntity>;
  /** Generated from the entities that are drawn. Nobody maintains it. ADR 0005 §6. */
  readonly types: readonly TypeFacet[];
  readonly links: readonly GeoLink[];
  readonly byLinkFid: ReadonlyMap<number, GeoLink>;
  /** Every drawn relation that touches an entity, in either direction, keyed by entity id. */
  readonly linksByEntity: ReadonlyMap<string, readonly GeoLink[]>;
  /**
   * How many relations this projection leaves out. **It goes on the screen.** A map that drops
   * evidence in silence is worse than one that says how much it dropped —
   * `docs/map-surface.md` §3.3.
   */
  readonly undrawableLinks: number;
  /** How many entities carry no geometry, and are therefore absent from every layer. */
  readonly undrawableEntities: number;
  /** West, south, east, north. `null` when nothing can be drawn. */
  readonly bounds: readonly [number, number, number, number] | null;
}

/**
 * The six entity hues of `src/theme.css`, converted from `oklch` to hex.
 *
 * Two reasons for the copy, both in `docs/map-surface.md` §5.3 and §9. A CSS custom property
 * never reaches MapLibre, which parses a colour with its own parser. And the **dark** set is
 * used, because every point sits on imagery and the light set is too dark to read on it.
 *
 * Rule 11 of the theme holds: these hues stay on the map and never enter the chrome. **A copy
 * that drifts is worse than a lookup**, and §9 carries that cost as undecided.
 */
const ENTITY_HUES = ['#70adfb', '#00c2d2', '#53c48e', '#a8b44b', '#df9b44', '#e887b6'] as const;

/** `geom` is nullable on `Entity`, and the narrowing has to survive the `map` below. */
const hasGeometry = (entity: Entity): entity is Entity & { readonly geom: Point } =>
  entity.geom !== null;

/** The key that the most entities of one type carry. Ties go to the alphabet. */
function dominantKey(entities: readonly GeoEntity[]): { key: string | null; keyCount: number } {
  const counts = new Map<string, number>();
  for (const entity of entities) {
    for (const key of Object.keys(entity.attrs)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let key: string | null = null;
  let keyCount = 0;
  for (const [candidate, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    if (count > keyCount) {
      key = candidate;
      keyCount = count;
    }
  }
  return { key, keyCount };
}

export function project(read: Corpus): Projection {
  const entities: readonly GeoEntity[] = read.entities.filter(hasGeometry).map((entity, fid) => ({
    fid,
    id: entity.id,
    type: entity.type,
    label: entity.label,
    lon: entity.geom.lon,
    lat: entity.geom.lat,
    sources: entity.sources,
    attrs: entity.attrs,
  }));

  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  const types: readonly TypeFacet[] = [...new Set(entities.map((entity) => entity.type))]
    .sort((a, b) => a.localeCompare(b))
    .map((type, index) => {
      const ofType = entities.filter((entity) => entity.type === type);
      const { key, keyCount } = dominantKey(ofType);
      return {
        type,
        colour: ENTITY_HUES[index % ENTITY_HUES.length] ?? ENTITY_HUES[0],
        count: ofType.length,
        key,
        keyCount,
      };
    });

  const links: GeoLink[] = [];
  read.relations.forEach((relation) => {
    if (relation.srcKind !== 'entity' || relation.dstKind !== 'entity') return;
    const from = byId.get(relation.srcId);
    const to = byId.get(relation.dstId);
    if (from === undefined || to === undefined) return;
    links.push({
      fid: links.length,
      id: relation.id,
      type: relation.type,
      from,
      to,
      sources: relation.sources,
      validFrom: relation.validFrom,
      validTo: relation.validTo,
      attrs: relation.attrs,
    });
  });

  const linksByEntity = new Map<string, GeoLink[]>();
  for (const link of links) {
    for (const end of [link.from.id, link.to.id]) {
      const held = linksByEntity.get(end);
      if (held === undefined) linksByEntity.set(end, [link]);
      else held.push(link);
    }
  }

  const bounds =
    entities.length === 0
      ? null
      : ([
          Math.min(...entities.map((entity) => entity.lon)),
          Math.min(...entities.map((entity) => entity.lat)),
          Math.max(...entities.map((entity) => entity.lon)),
          Math.max(...entities.map((entity) => entity.lat)),
        ] as const);

  return {
    entities,
    byFid: new Map(entities.map((entity) => [entity.fid, entity])),
    byId,
    types,
    links,
    byLinkFid: new Map(links.map((link) => [link.fid, link])),
    linksByEntity,
    undrawableLinks: read.relations.length - links.length,
    undrawableEntities: read.entities.length - entities.length,
    bounds,
  };
}
