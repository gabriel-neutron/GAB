import { typeHues, UNDECLARED_HUE } from '@/shared/entity-hues';
import type { Attributes, Corpus, Entity, Point, TypeVocabulary } from '@/shared/read/model';
import type { RailRows, RailTypeRow } from '@/shared/rail';

/**
 * MapLibre wants a number for a feature id: `fid` is an array position. `id` identifies the row.
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
 * A relation can point at another relation. It has no second point, so it is not drawn here.
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
}

export interface Projection {
  readonly entities: readonly GeoEntity[];
  readonly byFid: ReadonlyMap<number, GeoEntity>;
  readonly byId: ReadonlyMap<string, GeoEntity>;
  /** Generated from the entities that are drawn. Nobody maintains it. */
  readonly types: readonly TypeFacet[];
  /** The same facets, by type name. A caller that draws one group reads one entry. */
  readonly facetByType: ReadonlyMap<string, TypeFacet>;
  readonly links: readonly GeoLink[];
  readonly byLinkFid: ReadonlyMap<number, GeoLink>;
  /** Every drawn relation that touches an entity, in either direction, keyed by entity id. */
  readonly linksByEntity: ReadonlyMap<string, readonly GeoLink[]>;
  /** West, south, east, north. `null` when nothing can be drawn. */
  readonly bounds: readonly [number, number, number, number] | null;
}

// A point sits on dark imagery, so this surface takes the declared dark hue on the two themes.
const MAP_GROUND = 'dark';

/** `geom` is nullable on `Entity`, and the narrowing has to survive the `map` below. */
const hasGeometry = (entity: Entity): entity is Entity & { readonly geom: Point } =>
  entity.geom !== null;

/**
 * The polarity is inverted: the field says which type is hidden, and not which types are on.
 */
export interface RailFacet {
  readonly facet: TypeFacet;
  readonly hidden: boolean;
}

/** What the rail says about the map at this moment. */
export interface RailLegend {
  readonly facets: readonly RailFacet[];
  /** How many entities the map draws now. A type that switches off lowers it. */
  readonly drawn: number;
  readonly drawnTypes: ReadonlySet<string>;
}

export function railLegend(
  projection: Projection,
  isTypeVisible: (type: string) => boolean,
): RailLegend {
  const facets: readonly RailFacet[] = projection.types.map((facet) => ({
    facet,
    hidden: !isTypeVisible(facet.type),
  }));

  // One walk gives the count and the set. A second pass over the same array would be a second
  // answer to one question.
  let drawn = 0;
  const drawnTypes = new Set<string>();
  for (const entry of facets) {
    if (entry.hidden) continue;
    drawn += entry.facet.count;
    drawnTypes.add(entry.facet.type);
  }

  return { facets, drawn, drawnTypes };
}

/**
 * The hue is the hex the map parses, so no class can carry it and the swatch holds it inline.
 */
export function railRows(
  legend: RailLegend,
  openTypes: readonly string[],
  open: boolean,
): RailRows {
  const types: readonly RailTypeRow[] = legend.facets.map(({ facet, hidden }) => ({
    type: facet.type,
    initial: facet.type.slice(0, 1).toUpperCase(),
    count: facet.count,
    on: !hidden,
    open: openTypes.includes(facet.type),
    stateWord: hidden ? 'off' : 'on',
    // A name that said `on the map` for a type that is off is a false report to a reader who
    // cannot see the opacity of the swatch.
    name: `${facet.type}, ${facet.count} ${hidden ? 'off' : 'on'} the map`,
    colour: facet.colour,
  }));

  return {
    types,
    openTypes,
    everyTypeOff: types.length > 0 && types.every((row) => !row.on),
    open,
  };
}

export function entitiesOfType(projection: Projection, type: string): readonly GeoEntity[] {
  return projection.entities.filter((entity) => entity.type === type);
}

export function project(read: Corpus, declared: TypeVocabulary): Projection {
  const drawn = read.entities.filter(hasGeometry);

  // The declared hue of each type. This file drops an entity with no geometry and the graph
  // drops one with no position; a hue read from the declaration is the same on both, because
  // neither canvas is what states it.
  const hueOfType = typeHues(declared, MAP_GROUND);
  const types: readonly TypeFacet[] = [...new Set(drawn.map((entity) => entity.type))]
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({
      type,
      colour: hueOfType.get(type) ?? UNDECLARED_HUE,
      count: drawn.filter((entity) => entity.type === type).length,
    }));

  const entities: readonly GeoEntity[] = drawn.map((entity, fid) => ({
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

  const links: GeoLink[] = [];
  read.relations.forEach((relation) => {
    const from = relation.srcKind === 'entity' ? byId.get(relation.srcId) : undefined;
    const to = relation.dstKind === 'entity' ? byId.get(relation.dstId) : undefined;
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
    facetByType: new Map(types.map((facet) => [facet.type, facet])),
    links,
    byLinkFid: new Map(links.map((link) => [link.fid, link])),
    linksByEntity,
    bounds,
  };
}
