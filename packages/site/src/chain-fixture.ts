// A small chain of assets for the tests and the stories of the map: fields, a pipeline, a refinery,
// two export places, two assets outside Russia, three vessels, and the physical links between
// them. The names and the positions are made for the test. They are not data of the record. The
// rows go on top of the fixed release, which holds no physical link.

export const FIELD = '0a1f0000-0000-4000-8000-000000000101';
export const PIPELINE = '0a1f0000-0000-4000-8000-000000000102';
export const REFINERY = '0a1f0000-0000-4000-8000-000000000103';
export const CRUDE_TERMINAL = '0a1f0000-0000-4000-8000-000000000104';
export const PRODUCTS_PORT = '0a1f0000-0000-4000-8000-000000000105';
export const REFINERY_ABROAD = '0a1f0000-0000-4000-8000-000000000106';
export const TERMINAL_ABROAD = '0a1f0000-0000-4000-8000-000000000107';
export const TANKER = '0a1f0000-0000-4000-8000-000000000108';
export const OTHER_TANKER = '0a1f0000-0000-4000-8000-000000000109';

export const FIELD_TO_PIPELINE = '0a1f0000-0000-4000-8000-000000000111';
export const PIPELINE_TO_TERMINAL = '0a1f0000-0000-4000-8000-000000000112';
export const PIPELINE_TO_REFINERY = '0a1f0000-0000-4000-8000-000000000113';
export const PIPELINE_TO_ABROAD = '0a1f0000-0000-4000-8000-000000000114';
export const REFINERY_TO_PORT = '0a1f0000-0000-4000-8000-000000000115';
export const PORT_TO_ABROAD = '0a1f0000-0000-4000-8000-000000000116';
export const REFINERY_TO_TERMINAL = '0a1f0000-0000-4000-8000-000000000117';
export const TANKER_LOADS = '0a1f0000-0000-4000-8000-000000000118';
export const TANKER_STS = '0a1f0000-0000-4000-8000-000000000119';

const ACCEPTED = 'Validated manually by the operator, on 2026-10-04';
const PROPOSED = 'Proposed — not checked';
const LICENCE = '"derived fact; source under the provider licence, not redistributed"';

type Position = readonly [number, number];

interface Asset {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly kind: string | null;
  readonly geometry:
    | { readonly type: 'Point'; readonly coordinates: Position }
    | { readonly type: 'LineString'; readonly coordinates: readonly Position[] };
}

const point = (coordinates: Position) => ({ type: 'Point', coordinates }) as const;

// The positions outside Russia are well inside the outline of Belarus and of Turkey, so the
// simplified outlines of the basemap hold them.
const ASSETS: readonly Asset[] = [
  { id: FIELD, type: 'facility', label: 'Test field', kind: 'field', geometry: point([73.5, 62]) },
  {
    id: PIPELINE,
    type: 'facility',
    label: 'Test crude pipeline',
    kind: 'pipeline_segment',
    geometry: {
      type: 'LineString',
      coordinates: [
        [72, 61],
        [50, 58],
        [34, 57],
      ],
    },
  },
  {
    id: REFINERY,
    type: 'facility',
    label: 'Test refinery',
    kind: 'refinery',
    geometry: point([40, 47]),
  },
  {
    id: CRUDE_TERMINAL,
    type: 'facility',
    label: 'Test crude terminal',
    kind: 'export_terminal',
    geometry: point([28.7, 60.3]),
  },
  {
    id: PRODUCTS_PORT,
    type: 'port',
    label: 'Test products port',
    kind: null,
    geometry: point([37.8, 44.7]),
  },
  {
    id: REFINERY_ABROAD,
    type: 'facility',
    label: 'Test refinery abroad',
    kind: 'refinery',
    geometry: point([28, 53.5]),
  },
  {
    id: TERMINAL_ABROAD,
    type: 'facility',
    label: 'Test terminal abroad',
    kind: 'export_terminal',
    geometry: point([33, 39.5]),
  },
  { id: TANKER, type: 'vessel', label: 'Test tanker', kind: null, geometry: point([20, 56]) },
  {
    id: OTHER_TANKER,
    type: 'vessel',
    label: 'Other test tanker',
    kind: null,
    geometry: point([20.2, 56.1]),
  },
];

interface Link {
  readonly id: string;
  readonly type: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

const LINKS: readonly Link[] = [
  { id: FIELD_TO_PIPELINE, type: 'crude_flows_to', from: FIELD, to: PIPELINE, label: ACCEPTED },
  {
    id: PIPELINE_TO_TERMINAL,
    type: 'crude_flows_to',
    from: PIPELINE,
    to: CRUDE_TERMINAL,
    label: ACCEPTED,
  },
  {
    id: PIPELINE_TO_REFINERY,
    type: 'crude_flows_to',
    from: PIPELINE,
    to: REFINERY,
    label: ACCEPTED,
  },
  {
    id: PIPELINE_TO_ABROAD,
    type: 'crude_flows_to',
    from: PIPELINE,
    to: REFINERY_ABROAD,
    label: ACCEPTED,
  },
  {
    id: REFINERY_TO_PORT,
    type: 'products_flow_to',
    from: REFINERY,
    to: PRODUCTS_PORT,
    label: ACCEPTED,
  },
  {
    id: PORT_TO_ABROAD,
    type: 'products_flow_to',
    from: PRODUCTS_PORT,
    to: TERMINAL_ABROAD,
    label: ACCEPTED,
  },
  {
    id: REFINERY_TO_TERMINAL,
    type: 'products_flow_to',
    from: REFINERY,
    to: CRUDE_TERMINAL,
    label: PROPOSED,
  },
  { id: TANKER_LOADS, type: 'loads_at', from: TANKER, to: CRUDE_TERMINAL, label: ACCEPTED },
  { id: TANKER_STS, type: 'sts_with', from: TANKER, to: OTHER_TANKER, label: ACCEPTED },
];

const labelOf = (id: string): string => ASSETS.find((one) => one.id === id)?.label ?? id;

const ENTITIES = ASSETS.map(
  (one) => `${one.id},${one.type},${one.label},"${ACCEPTED}",${LICENCE},chain`,
);

const RELATIONS = LINKS.map(
  (one) =>
    `${one.id},${one.type},${one.from},${labelOf(one.from)},${one.to},${labelOf(one.to)},,,"${one.label}",${LICENCE},chain,${one.type.replaceAll('_', ' ')},`,
);

const SOURCE = `chain,A test document,https://chain.example.org/page,2026-09-28`;

const CLAIMS = [
  ...ASSETS.flatMap((one) =>
    one.kind === null
      ? []
      : [
          `${one.id}/asset_kind,attribute,entity,${one.id},${one.label},asset_kind,${one.kind},,,,,,"${ACCEPTED}",${LICENCE},${SOURCE},1,a test excerpt,asserts,false`,
        ],
  ),
  ...LINKS.map(
    (one) =>
      `${one.id},relation,entity,${one.from},${labelOf(one.from)},,,${one.type},${one.to},${labelOf(one.to)},,,"${one.label}",${LICENCE},${SOURCE},,,,`,
  ),
];

const FEATURES = ASSETS.map((one) => ({
  type: 'Feature',
  id: one.id,
  geometry: one.geometry,
  properties: { id: one.id, type: one.type, label: one.label, asset_kind: one.kind },
}));

const appended = (text: string, rows: readonly string[]): string =>
  rows.length === 0 ? text : `${text}${rows.join('\r\n')}\r\n`;

const ROWS: ReadonlyMap<string, readonly string[]> = new Map([
  ['entities.csv', ENTITIES],
  ['relations.csv', RELATIONS],
  ['claims.csv', CLAIMS],
]);

const withFeatures = (geojson: string): string => {
  const collection: unknown = JSON.parse(geojson);
  if (typeof collection !== 'object' || collection === null || !('features' in collection))
    return geojson;
  const features: unknown = collection.features;
  return JSON.stringify({
    ...collection,
    features: Array.isArray(features)
      ? [...features.map((one: unknown) => one), ...FEATURES]
      : FEATURES,
  });
};

/** The files of a release, with the chain of the fixture added to its entities, relations, claims
 * and positions. */
export const withChain = (files: ReadonlyMap<string, string>): Map<string, string> =>
  new Map(
    [...files].map(([path, text]) => [
      path,
      path === 'entities.geojson' ? withFeatures(text) : appended(text, ROWS.get(path) ?? []),
    ]),
  );
