import { positionFromWords } from '@/shared/canvas-label';
import { typeHues, UNDECLARED_HUE, type HueTheme } from '@/shared/entity-hues';
import { unitHierarchy, type UnitHierarchy } from '@/shared/fold-subordinates';
import type {
  Area,
  Attributes,
  Corpus,
  Entity,
  MapPosition,
  Point,
  TypeVocabulary,
} from '@/shared/read/model';
import type { RailRows, RailTypeRow } from '@/shared/rail';
import { relationWording } from '@/shared/relation-words';

import { natoSymbol, type NatoSymbol } from './nato-symbol';

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
  /** The shape of an entity that a polygon locates, and null for a point. `lon` and `lat` are then
   * a point inside it: the one mark of the entity, so the rail, the selection and the relations
   * read an area as they read a point. */
  readonly area: Area | null;
  readonly sources: readonly string[];
  /** M7 and M8: a value, and the documents that carry it. The index rows read these. */
  readonly attrs: Attributes;
  /** The ancestor this point was taken from, and null when the entity stands at its own point.
   * **The halo is drawn from this and never from the words.** The map read already weighed the
   * `inherited` word against the geometry, and a label that no row supplies must not undraw it. */
  readonly parentId: string | null;
  /** The borrowed position, worded, or null. The derivation words it so that every surface says
   * it the same way and none of them words it twice. */
  readonly positionFrom: string | null;
  /** The military marks, and null for every entity that is not a unit. The frame, the marks and
   * the words are read here once, so the index row and the hover label cannot disagree. */
  readonly symbol: NatoSymbol | null;
}

/**
 * A relation can point at another relation. It has no second point, so it is not drawn here.
 */
export interface GeoLink {
  readonly fid: number;
  readonly id: string;
  readonly type: string;
  /** The words of the type, read from the source end. The hover label reads these. */
  readonly typeWords: string;
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
  /** The chain of command between the drawn entities. The rail folds its list by it. */
  readonly hierarchy: UnitHierarchy;
}

// A point sits on dark imagery, so this surface takes the declared dark hue on the two themes.
const MAP_GROUND: HueTheme = 'dark';

/** One entity, and the row `api.full_map` gave it. The narrowing has to survive the `map` below,
 * because `point` is nullable for an entity that no walk could place. */
interface Drawn {
  readonly entity: Entity;
  readonly at: MapPosition & { readonly point: Point };
}

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
  readonly openUnits: ReadonlySet<string>;
}

export function railLegend(
  projection: Projection,
  isTypeVisible: (type: string) => boolean,
  openUnits: ReadonlySet<string>,
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

  return { facets, drawn, drawnTypes, openUnits };
}

/**
 * The hue is the hex the map parses, so no class can carry it and the swatch holds it inline.
 */
export function railRows(
  legend: RailLegend,
  openTypes: readonly string[],
  frame: Pick<RailRows, 'open' | 'width'>,
  linksOn: boolean,
): RailRows {
  const types: readonly RailTypeRow[] = legend.facets.map(({ facet, hidden }) => ({
    type: facet.type,
    initial: facet.type.slice(0, 1).toUpperCase(),
    // Departure: the count is the whole type, and a fold of the list does not change it.
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
    // The lines are drawn for the selection alone, and the name says what the control does and
    // never how far it reaches.
    links: {
      on: linksOn,
      label: 'Relation lines',
      name: `relation lines, ${linksOn ? 'on' : 'off'} the map`,
    },
    openTypes,
    everyTypeOff: types.length > 0 && types.every((row) => !row.on),
    open: frame.open,
    width: frame.width,
  };
}

export function entitiesOfType(projection: Projection, type: string): readonly GeoEntity[] {
  return projection.entities.filter((entity) => entity.type === type);
}

export function project(read: Corpus, declared: TypeVocabulary): Projection {
  // The label of every entity, and not of the drawn ones alone: an ancestor that lends its point
  // may carry no point in a later read, and the child would then name nobody.
  const labelOfEntity = new Map(read.entities.map((entity) => [entity.id, entity.label]));

  // The resolved position decides what is drawn, and `Entity.geom` no longer does. The two
  // disagree by design for an entity that inherits its point: it carries no geometry, and it has
  // a position. An entity with no row at all is drawn nowhere.
  const positionOf = new Map(read.positions.map((at) => [at.entityId, at]));
  const drawn: readonly Drawn[] = read.entities.flatMap((entity) => {
    const at = positionOf.get(entity.id);
    const point = at?.point ?? null;
    return at === undefined || point === null ? [] : [{ entity, at: { ...at, point } }];
  });

  // The declared hue of each type. This file drops an entity the walk could not place and the
  // graph drops one with no position; a hue read from the declaration is the same on both,
  // because neither canvas is what states it.
  const hueOfType = typeHues(declared, MAP_GROUND);
  const types: readonly TypeFacet[] = [...new Set(drawn.map(({ entity }) => entity.type))]
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({
      type,
      colour: hueOfType.get(type) ?? UNDECLARED_HUE[MAP_GROUND],
      count: drawn.filter(({ entity }) => entity.type === type).length,
    }));

  const entities: readonly GeoEntity[] = drawn.map(({ entity, at }, fid) => ({
    fid,
    id: entity.id,
    type: entity.type,
    label: entity.label,
    lon: at.point.lon,
    lat: at.point.lat,
    area: at.area,
    sources: entity.sources,
    attrs: entity.attrs,
    // The identity and the words are separate on purpose. An ancestor that the entity list does
    // not hold still borrowed the point, so the halo stands and only the words fall away.
    parentId: at.parentId,
    positionFrom:
      at.parentId === null ? null : positionFromWords(labelOfEntity.get(at.parentId) ?? 'a parent'),
    symbol: natoSymbol(entity.type, entity.attrs),
  }));

  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  const links: GeoLink[] = [];
  const wordsOf = relationWording(read.relationTypes);
  read.relations.forEach((relation) => {
    const from = relation.srcKind === 'entity' ? byId.get(relation.srcId) : undefined;
    const to = relation.dstKind === 'entity' ? byId.get(relation.dstId) : undefined;
    if (from === undefined || to === undefined) return;
    links.push({
      fid: links.length,
      id: relation.id,
      type: relation.type,
      typeWords: wordsOf(relation.type).label,
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

  // The frame holds the whole of an area, and not its mark alone. A loop, because a spread of
  // every vertex into `Math.min` overflows the stack on a large coastline.
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const widen = (lon: number, lat: number): void => {
    west = Math.min(west, lon);
    south = Math.min(south, lat);
    east = Math.max(east, lon);
    north = Math.max(north, lat);
  };
  for (const entity of entities) {
    widen(entity.lon, entity.lat);
    for (const rings of entity.area ?? []) {
      for (const ring of rings) for (const [lon, lat] of ring) widen(lon, lat);
    }
  }
  const bounds: Projection['bounds'] = entities.length === 0 ? null : [west, south, east, north];

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
    hierarchy: unitHierarchy(read.relations, new Set(byId.keys())),
  };
}
