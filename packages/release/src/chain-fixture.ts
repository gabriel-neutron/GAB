// A small chain of assets for the tests of the map: fields, a pipeline, a refinery,
// two export places, two assets outside Russia, two vessels, two assets with no position, the physical links between them, and
// a volume for some links. The names and the positions are made for the test. They are not data
// of the record. The rows go on top of the fixed release, which holds no physical link.

/** The identifiers of the chain: its assets, then its links. */
export const CHAIN = {
  FIELD: '0a1f0000-0000-4000-8000-000000000101',
  PIPELINE: '0a1f0000-0000-4000-8000-000000000102',
  REFINERY: '0a1f0000-0000-4000-8000-000000000103',
  CRUDE_TERMINAL: '0a1f0000-0000-4000-8000-000000000104',
  PRODUCTS_PORT: '0a1f0000-0000-4000-8000-000000000105',
  REFINERY_ABROAD: '0a1f0000-0000-4000-8000-000000000106',
  TERMINAL_ABROAD: '0a1f0000-0000-4000-8000-000000000107',
  TANKER: '0a1f0000-0000-4000-8000-000000000108',
  OTHER_TANKER: '0a1f0000-0000-4000-8000-000000000109',
  UNPLACED_PORT: '0a1f0000-0000-4000-8000-00000000010a',
  UNPLACED_FIELD: '0a1f0000-0000-4000-8000-00000000010b',
  FIELD_TO_PIPELINE: '0a1f0000-0000-4000-8000-000000000111',
  PIPELINE_TO_TERMINAL: '0a1f0000-0000-4000-8000-000000000112',
  PIPELINE_TO_REFINERY: '0a1f0000-0000-4000-8000-000000000113',
  PIPELINE_TO_ABROAD: '0a1f0000-0000-4000-8000-000000000114',
  REFINERY_TO_PORT: '0a1f0000-0000-4000-8000-000000000115',
  PORT_TO_ABROAD: '0a1f0000-0000-4000-8000-000000000116',
  REFINERY_TO_TERMINAL: '0a1f0000-0000-4000-8000-000000000117',
  TANKER_LOADS: '0a1f0000-0000-4000-8000-000000000118',
  TANKER_STS: '0a1f0000-0000-4000-8000-000000000119',
  UNPLACED_LOADS: '0a1f0000-0000-4000-8000-00000000011a',
  UNPLACED_TO_ABROAD: '0a1f0000-0000-4000-8000-00000000011b',
} as const;

const {
  FIELD,
  PIPELINE,
  REFINERY,
  CRUDE_TERMINAL,
  PRODUCTS_PORT,
  REFINERY_ABROAD,
  TERMINAL_ABROAD,
  TANKER,
  OTHER_TANKER,
  FIELD_TO_PIPELINE,
  PIPELINE_TO_TERMINAL,
  PIPELINE_TO_REFINERY,
  PIPELINE_TO_ABROAD,
  REFINERY_TO_PORT,
  PORT_TO_ABROAD,
  REFINERY_TO_TERMINAL,
  TANKER_LOADS,
  TANKER_STS,
  UNPLACED_PORT,
  UNPLACED_FIELD,
  UNPLACED_LOADS,
  UNPLACED_TO_ABROAD,
} = CHAIN;

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
    | { readonly type: 'LineString'; readonly coordinates: readonly Position[] }
    | null;
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
    geometry: point([42, 64]),
  },
  {
    id: PRODUCTS_PORT,
    type: 'port',
    label: 'Test products port',
    kind: null,
    geometry: point([44, 53]),
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
  // Two assets with no position: the map cannot tell if they are in Russia.
  {
    id: UNPLACED_PORT,
    type: 'port',
    label: 'Test port with no position',
    kind: null,
    geometry: null,
  },
  {
    id: UNPLACED_FIELD,
    type: 'facility',
    label: 'Test field with no position',
    kind: 'field',
    geometry: null,
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
  { id: UNPLACED_LOADS, type: 'loads_at', from: TANKER, to: UNPLACED_PORT, label: ACCEPTED },
  {
    id: UNPLACED_TO_ABROAD,
    type: 'crude_flows_to',
    from: UNPLACED_FIELD,
    to: REFINERY_ABROAD,
    label: ACCEPTED,
  },
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

// The volume rows are made for the test too: the figures and the document are not data of the
// research. The link from the field has a flow and a capacity, and one row joins no link.
const VOLUME_SOURCE = 'chain,A test document,https://chain.example.org/page';

const volume = (
  link: string,
  values: string,
  unit: string,
  volumeClass: string,
  note = '',
): string => {
  const one = LINKS.find((each) => each.id === link);
  const product = one?.type === 'products_flow_to' ? 'products' : 'crude';
  return `${link},${one?.from ?? ''},${one?.to ?? ''},${product},2026-07,${values},${unit},${volumeClass},${VOLUME_SOURCE},2,${note},${LICENCE}`;
};

const VOLUMES = [
  volume(FIELD_TO_PIPELINE, '400,,', 'kb/j', 'observed', 'a test note'),
  volume(FIELD_TO_PIPELINE, '600,,', 'kb/j', 'capacity'),
  volume(PIPELINE_TO_TERMINAL, '200,,', 'kb/j', 'observed'),
  volume(PIPELINE_TO_REFINERY, '150,100,180', 'kb/j', 'estimated'),
  volume(REFINERY_TO_PORT, '5,,', 'Mt/an', 'capacity'),
  volume(REFINERY_TO_TERMINAL, '50,,', 'kt/mois', 'observed'),
  `,Test segment A,Test segment B,crude,2026-07,900,,,kb/j,capacity,${VOLUME_SOURCE},,,${LICENCE}`,
];

const FEATURES = ASSETS.flatMap((one) =>
  one.geometry === null
    ? []
    : [
        {
          type: 'Feature',
          id: one.id,
          geometry: one.geometry,
          properties: { id: one.id, type: one.type, label: one.label, asset_kind: one.kind },
        },
      ],
);

const appended = (text: string, rows: readonly string[]): string =>
  rows.length === 0 ? text : `${text}${rows.join('\r\n')}\r\n`;

const ROWS: ReadonlyMap<string, readonly string[]> = new Map([
  ['entities.csv', ENTITIES],
  ['relations.csv', RELATIONS],
  ['claims.csv', CLAIMS],
  ['volumes.csv', VOLUMES],
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

/** The files of a release, with the chain of the fixture added to its entities, relations, claims,
 * volumes and positions. */
export const withChain = (files: ReadonlyMap<string, string>): Map<string, string> =>
  new Map(
    [...files].map(([path, text]) => [
      path,
      path === 'entities.geojson' ? withFeatures(text) : appended(text, ROWS.get(path) ?? []),
    ]),
  );
