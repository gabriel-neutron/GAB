/**
 * The corpus, reduced to what a map can draw.
 *
 * Built from `docs/map-surface.md` §4.1, §4.5, §4.6 and §4.7. It is the one place that decides
 * what "on the map" means, and every other component of the surface reads it. §4.1 gives the
 * projection itself, §4.5 gives `railLegend` and `entitiesMatching`, §4.6 gives the key of a type
 * and the cell that carries it, and §4.7 gives `LinkRow` and `linksOfSelection`.
 *
 * **It holds no state and it reads no module.** It takes the read as an argument, so the day
 * `src/contract/` exists the caller changes and this file does not. `spec.md` §4 puts the read
 * behind a view; until then the caller passes the fixture of #46.
 */

import type { Attributes, Corpus, Entity, Point } from '@/shared/fixtures/types';
import type { RailRows, RailTypeRow } from '@/shared/rail';

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
  /**
   * The value of this entity's own type key — `TypeFacet.key` — rendered as text for one cell of
   * the index. `docs/map-surface.md` §4.6 puts that one column beside the name.
   *
   * **The empty string is the contract, and it is what draws a blank cell.** M9: the unknown is
   * the absence of a key, and the row must read as an absence and not as a fault. Never `N/A`,
   * never a dash and never `0`. M7: a flat list joins with `', '`.
   */
  readonly keyValue: string;
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
  /** The same facets, by type name. A caller that draws one group reads one entry. */
  readonly facetByType: ReadonlyMap<string, TypeFacet>;
  /** The drawn entities of each type, in the order of `entities`. The index draws one group. */
  readonly entitiesByType: ReadonlyMap<string, readonly GeoEntity[]>;
  readonly links: readonly GeoLink[];
  readonly byLinkFid: ReadonlyMap<number, GeoLink>;
  /** Every drawn relation that touches an entity, in either direction, keyed by entity id. */
  readonly linksByEntity: ReadonlyMap<string, readonly GeoLink[]>;
  /**
   * How many relations this projection leaves out, counted one relation at a time. **It goes on
   * the screen.** A map that drops evidence in silence is worse than one that says how much it
   * dropped — `docs/map-surface.md` §3.3. Each relation in this count has an endpoint that the
   * map draws nowhere, and the number cannot say which of the three reasons applies.
   */
  readonly undrawableLinks: number;
  /** How many entities carry no geometry, and are therefore absent from every layer. */
  readonly undrawableEntities: number;
  /** West, south, east, north. `null` when nothing can be drawn. */
  readonly bounds: readonly [number, number, number, number] | null;
}

/**
 * The six entity hues of `src/index.css`, converted from `oklch` to hex. It is the **dark** set.
 *
 * **A colour must be a colour that the library reads** — `docs/map-surface.md` §5.3 and §9.
 * MapLibre parses the style with its own parser, so a CSS custom property never reaches it.
 *
 * **The ground that the dark set was chosen for is not there.** Step 4 is blocked, and
 * `adapter.ts` says so plainly: the canvas is transparent, and no point sits on imagery. The
 * colour behind a point is the page. So the measurements below are against `--background` of
 * `src/index.css`, in each theme: `#f5f7f8` in the light theme, and `#070f10` in the dark theme.
 * The six hues give 2.02:1 to 2.28:1 on the light page, and 7.91:1 to 8.91:1 on the dark page.
 * The light page is therefore the weak one today.
 *
 * **Step 4 is the point where this set must be read again.** It restores the imagery, and a point
 * over imagery is a different question. A second copy for the light page now is one more thing
 * that step 4 must undo, so the operator holds the values as they are.
 *
 * Rule 11 of the theme holds: these hues stay on the map and never enter the chrome. **A copy
 * that drifts is worse than a lookup**, and §9 carries that cost as undecided.
 */
const ENTITY_HUES = ['#70adfb', '#00c2d2', '#53c48e', '#a8b44b', '#df9b44', '#e887b6'] as const;

/** `geom` is nullable on `Entity`, and the narrowing has to survive the `map` below. */
const hasGeometry = (entity: Entity): entity is Entity & { readonly geom: Point } =>
  entity.geom !== null;

/** The key that the most entities of one type carry. Ties go to the alphabet. */
function dominantKey(entities: readonly { readonly attrs: Attributes }[]): {
  key: string | null;
  keyCount: number;
} {
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

/**
 * The value one entity holds for one key, as the text of a cell.
 *
 * `docs/map-surface.md` §4.6, and M7 and M9 of `decisions.md`. A flat list joins with `', '`. A
 * key the entity does not carry, and a type that carries no key at all, both give the empty
 * string, which is the blank cell the row draws under the header that names the key.
 */
function keyValueOf(attrs: Attributes, key: string | null): string {
  if (key === null) return '';
  const held = attrs[key];
  if (held === undefined) return '';
  // M7: a value is a scalar or a flat list, and never an object, so `typeof` separates the two.
  return typeof held.v === 'object' ? held.v.join(', ') : String(held.v);
}

/**
 * One entry of the rail: the type, and whether it is switched off.
 *
 * **The polarity of §5.2 reaches this shape.** The field says which type is **hidden**, and no
 * value here is a list of the types that are on. The type list is a projection (ADR 0005 §6), so
 * the corpus gains a type whenever a document does, and a new type that nobody has switched off
 * is drawn.
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
  /**
   * The types the map draws now. **A caller reads this set, and it derives no second one.** The
   * rail asks it for the other endpoint of each relation, so the list of the relations and the
   * type switches answer from one value at each render.
   */
  readonly drawnTypes: ReadonlySet<string>;
  /**
   * How many relations the map draws now. A type that switches off lowers it, because a relation
   * needs both of its endpoints on the map.
   *
   * **The switch of the relations does not lower it.** That switch is a state, and the rail says
   * the state in one word beside this number, exactly as a type switch does.
   */
  readonly drawnLinks: number;
}

/**
 * Whether the map draws one relation, under the type filter of this moment.
 *
 * **A relation needs both of its endpoints on the map** — `docs/map-surface.md` §5.1, and
 * `adapter.ts` paints its lines by the same rule. One rule here keeps the rail and the map from
 * two answers to one question.
 */
const isDrawnLink = (link: GeoLink, isTypeVisible: (type: string) => boolean): boolean =>
  isTypeVisible(link.from.type) && isTypeVisible(link.to.type);

/**
 * The legend of the rail, taken from the map itself.
 *
 * `docs/map-surface.md` §4.5 and §3.1: four items survive the layer panel, and they are an entry
 * per entity type, a colour, a count and visibility. This function derives the four, and it
 * decides nothing about presentation.
 *
 * **It also counts the relations the map draws now** — §4.7. The switch of the relations states a
 * count, and a count that stays while a type goes off states a number that is not on the map.
 *
 * **Visibility is asked of the handle, so the adapter stays the one writer** — §4.4 and §5.2. The
 * caller passes `handle.isTypeVisible`, and this file reads no store of its own.
 */
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

  // The relations are counted one at a time, at the one place that decides what a line is. A
  // count taken from the type counts would answer a different question — M4.
  let drawnLinks = 0;
  for (const link of projection.links) {
    if (isDrawnLink(link, isTypeVisible)) drawnLinks += 1;
  }

  return { facets, drawn, drawnTypes, drawnLinks };
}

/**
 * The entities of one type whose name holds the text of the search field.
 *
 * `docs/map-surface.md` §4.5: finding an entity is a search, inside one type. §9 records that a
 * search across the corpus is its own capability (W9), and this is not that: it is a control on
 * one filter. The order of the projection is kept, because no document states an order.
 *
 * The comparison is made on a trimmed and lowered copy of the text, so that a name is reached by
 * how it reads and not by how it was typed.
 */
/**
 * The rows of the shared rail, for one legend and one step.
 *
 * **The shared control draws, and this computes** — `src/shared/rail.tsx` states no word of its
 * own about a type. The word for a type that is off is `off` here, because the map hides a layer;
 * the graph dims one and says so. Each surface states its own consequence.
 *
 * **The swatch stays.** §5.5 rule 11 keeps the entity hues on the map and out of the chrome, and
 * §3.1 and §4.5 keep the colour swatch per entry: it is the legend, and a coloured point means
 * nothing without one. The hue is the hex the map parses, so no class can carry it.
 */
export function railRows(
  legend: RailLegend,
  openType: string | null,
  query: string,
  open: boolean,
): RailRows {
  const types: readonly RailTypeRow[] = legend.facets.map(({ facet, hidden }) => ({
    type: facet.type,
    initial: facet.type.slice(0, 1).toUpperCase(),
    count: facet.count,
    on: !hidden,
    open: openType === facet.type,
    stateWord: hidden ? 'off' : 'on',
    // A name that said `on the map` for a type that is off is a false report to a reader who
    // cannot see the opacity of the swatch.
    name: `${facet.type}, ${facet.count} ${hidden ? 'off' : 'on'} the map`,
    colour: facet.colour,
  }));

  return {
    types,
    openType,
    query,
    everyTypeOff: types.length > 0 && types.every((row) => !row.on),
    open,
  };
}

export function entitiesMatching(
  projection: Projection,
  type: string,
  query: string,
): readonly GeoEntity[] {
  const wanted = query.trim().toLowerCase();
  return projection.entities.filter(
    (entity) =>
      entity.type === type && (wanted === '' || entity.label.toLowerCase().includes(wanted)),
  );
}

/**
 * One relation of the selected entity, as the rail lists it.
 *
 * **It carries no interval and no source document.** `docs/map-surface.md` §4.7 gives those two
 * to a card, and §7 keeps the owner of a relation surface open with no ticket. So the operator
 * decides who draws them, and M6 cannot be broken at one end here, because no end is written.
 */
export interface LinkRow {
  /** The identity of the relation. It keys the row: `fid` is a position in an array. */
  readonly id: string;
  /**
   * Which way the relation points. `out` where the selected entity is the source of it.
   *
   * **The two cases are a closed set, and never a glyph.** A derivation states the direction, and
   * the rail states how it reads.
   */
  readonly direction: 'out' | 'in';
  /** The type of the relation, as the corpus states it. */
  readonly type: string;
  /** The endpoint that is not the selected entity. Choosing the row selects this entity. */
  readonly other: GeoEntity;
}

/**
 * The drawn relations that touch the selected entity.
 *
 * `docs/map-surface.md` §4.7: "Selecting an entity brightens its links and lists them." The map
 * brightens, and the rail lists. An empty list is the answer for an entity that touches no
 * relation which can be drawn, and the rail says so in one sentence.
 *
 * **A relation whose other endpoint is not drawn is not a row.** A type that is switched off takes
 * its points and its lines off the map, so a row for such a relation offers the analyst a place
 * that the map shows nowhere: the camera flies to nothing and the selection is refused. The map
 * and the rail therefore hold one rule, and the count beside the list is the length of this array.
 *
 * **Visibility is asked of the caller, so the adapter stays the one writer** — §4.4 and §5.2, the
 * same shape as `railLegend` above.
 */
export function linksOfSelection(
  projection: Projection,
  selected: string | null,
  isTypeVisible: (type: string) => boolean,
): readonly LinkRow[] {
  if (selected === null) return [];
  const held = projection.linksByEntity.get(selected) ?? [];
  const rows: LinkRow[] = [];
  for (const link of held) {
    const out = link.from.id === selected;
    const other = out ? link.to : link.from;
    // The one rule of a drawn relation, and never a second one — see `isDrawnLink`.
    if (!isDrawnLink(link, isTypeVisible)) continue;
    rows.push({ id: link.id, direction: out ? 'out' : 'in', type: link.type, other });
  }
  return rows;
}

export function project(read: Corpus): Projection {
  const drawn = read.entities.filter(hasGeometry);

  // The types are derived before the entities, because each entity carries the value of its own
  // type's key. §3.2 makes that key machine-derived, and ADR 0005 §6 keeps it that way.
  const types: readonly TypeFacet[] = [...new Set(drawn.map((entity) => entity.type))]
    .sort((a, b) => a.localeCompare(b))
    .map((type, index) => {
      const ofType = drawn.filter((entity) => entity.type === type);
      const { key, keyCount } = dominantKey(ofType);
      return {
        type,
        colour: ENTITY_HUES[index % ENTITY_HUES.length] ?? ENTITY_HUES[0],
        count: ofType.length,
        key,
        keyCount,
      };
    });

  const keyOfType = new Map(types.map((facet) => [facet.type, facet.key]));

  const entities: readonly GeoEntity[] = drawn.map((entity, fid) => ({
    fid,
    id: entity.id,
    type: entity.type,
    label: entity.label,
    lon: entity.geom.lon,
    lat: entity.geom.lat,
    sources: entity.sources,
    attrs: entity.attrs,
    keyValue: keyValueOf(entity.attrs, keyOfType.get(entity.type) ?? null),
  }));

  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  // One walk fills the groups, and it keeps the order of `entities`. A caller that draws one
  // group then reads a value that is already derived.
  const entitiesByType = new Map<string, GeoEntity[]>();
  for (const entity of entities) {
    const held = entitiesByType.get(entity.type);
    if (held === undefined) entitiesByType.set(entity.type, [entity]);
    else held.push(entity);
  }

  const links: GeoLink[] = [];
  /**
   * **The count is derived from each relation, and it is not a difference of two lengths.** M4
   * warns against the count of a list that answers a different question. A relation is counted
   * here at the one place that drops it, so the number and the sentence beside it say the same
   * thing: this relation has an endpoint that the map draws nowhere. The reasons are three — an
   * endpoint that is a relation, an endpoint that carries no geometry, and an endpoint that the
   * corpus does not contain — and the sentence names none of the three, because one number
   * cannot separate them.
   */
  let undrawableLinks = 0;
  read.relations.forEach((relation) => {
    const from = relation.srcKind === 'entity' ? byId.get(relation.srcId) : undefined;
    const to = relation.dstKind === 'entity' ? byId.get(relation.dstId) : undefined;
    if (from === undefined || to === undefined) {
      undrawableLinks += 1;
      return;
    }
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
    entitiesByType,
    links,
    byLinkFid: new Map(links.map((link) => [link.fid, link])),
    linksByEntity,
    undrawableLinks,
    undrawableEntities: read.entities.length - entities.length,
    bounds,
  };
}
