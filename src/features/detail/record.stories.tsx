import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';

import type {
  Attribute,
  AttributeValue,
  Attributes,
  Corpus,
  DocId,
  DocumentRow,
} from '@/shared/fixtures/types';

import { readDossier, type RecordRow } from './dossier';
import { SourceMark } from './mark';
import { EntityRecord } from './record';

// The committed fixture has three claims, which cannot show density. This file builds its own
// probe. No other file reads it.

const PER_FAMILY = 15;

const pad = (n: number): string => String(n).padStart(2, '0');

const CITED: readonly DocId[] = ['doc-registry', 'doc-class', 'doc-survey', 'doc-broker'];

const cite = (n: number): readonly DocId[] => [CITED[n % CITED.length] ?? 'doc-registry'];

// This key carries no source on purpose. Without the fault, the mark story compares 100 to 100
// and cannot fail.
const UNSOURCED_KEY = 'current_cargo';

const srcFor = (key: string, n: number): readonly DocId[] => {
  if (key === UNSOURCED_KEY) return [];
  if (key === 'imo_number') return ['doc-imo'];
  return cite(n);
};

const NAMED: readonly (readonly [string, AttributeValue])[] = [
  ['imo_number', '9482137'],
  ['mmsi', '232004521'],
  ['call_sign', 'MDQE7'],
  ['vessel_name', 'Northern Aurora'],
  ['flag_state', 'United Kingdom'],
  ['port_of_registry', 'Glasgow'],
  ['delivered_on', '2019-04-17'],
  ['length_overall_m', 229.2],
  ['beam_moulded_m', 32.26],
  ['summer_draught_m', 14.4],
  ['gross_tonnage', 32567],
  ['net_tonnage', 18442],
  ['deadweight_t', 81600],
  ['engine_builder', 'MAN B&W'],
  ['service_speed_kn', 14.2],
  ['bunker_capacity_t', 2450],
  ['class_society', 'Lloyd Register'],
  ['ice_class', '1A'],
  [
    'condition_note',
    'Hull survey of 2024 reports pitting in way of the number three cargo hold, port side.',
  ],
  ['registered_owner', 'Aurora Shipping Ltd'],
  ['insured_value_usd', 41500000],
  ['last_port_of_call', 'Rotterdam'],
  [UNSOURCED_KEY, 'Steel coils'],
  ['sanctions_listed', false],
  ['crew_certified', true],
];

const FAMILIES: readonly {
  readonly key: (n: number) => string;
  readonly value: (n: number) => AttributeValue;
}[] = [
  { key: (n) => `holds_${n}_capacity_t`, value: (n) => 4200 + n * 137 },
  { key: (n) => `crane_${n}_safe_working_load_t`, value: (n) => 30 + n },
  { key: (n) => `engine_${n}_output_kw`, value: (n) => 8600 + n * 45 },
  { key: (n) => `cargo_tank_${n}_volume_m3`, value: (n) => 1180 + n * 17 },
  { key: (n) => `psc_inspection_${n}_on`, value: (n) => `2021-${pad((n % 12) + 1)}-1${n % 9}` },
];

function probeAttributes(): Attributes {
  const attrs: Record<string, Attribute> = {};

  let index = 0;
  for (const [key, v] of NAMED) {
    attrs[key] = { v, src: srcFor(key, index) };
    index += 1;
  }

  let family = 0;
  for (const { key, value } of FAMILIES) {
    for (let n = 1; n <= PER_FAMILY; n += 1) {
      attrs[key(n)] = { v: value(n), src: cite(family + n) };
    }
    family += 1;
  }

  return attrs;
}

const document_ = (id: DocId, title: string): DocumentRow => ({
  id,
  kind: 'report',
  title,
  uri: `https://example.invalid/${id}`,
  archiveUri: null,
  sha256: null,
  retrievedAt: '2026-02-11',
  admiralty: 'B2',
  admiraltyOrigin: 'machine',
});

const CORPUS: Corpus = {
  documents: [
    document_('doc-registry', 'Registry extract, 2026'),
    document_('doc-class', 'Class record, 2026'),
    document_('doc-survey', 'Survey report, 2025'),
    document_('doc-broker', 'Broker sheet, 2026'),
    document_('doc-imo', 'IMO number certificate, 2019'),
  ],
  entities: [
    {
      id: 'probe-1',
      type: 'vessel',
      label: 'Northern Aurora',
      attrs: probeAttributes(),
      sources: ['doc-registry'],
      geom: null,
      promotedFrom: 'proposal-probe-1',
    },
  ],
  relations: [],
  proposals: [],
  agents: [],
  agentCalls: [],
};

const ROWS: readonly RecordRow[] = readDossier(CORPUS, 'probe-1')?.rows ?? [];

const onSelectSource = fn();

const meta = {
  component: EntityRecord,
  args: {
    rows: ROWS,
    mark: (sources) => (
      <SourceMark sources={sources} activeSource={null} onSelectSource={onSelectSource} />
    ),
  },
  // The width of the pane is part of the contract, so each story states it.
  render: (args) => (
    <div className="w-[1200px] p-2">
      <EntityRecord {...args} />
    </div>
  ),
} satisfies Meta<typeof EntityRecord>;

export default meta;

type Story = StoryObj<typeof meta>;

const claimCells = (root: HTMLElement): readonly HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-claim]'));

// `document.fonts.ready` is awaited first. If a declared font is installed, the text reflows
// after an early measurement and the story flakes.
const linesOnThePage = async (root: HTMLElement): Promise<number> => {
  await document.fonts.ready;

  const tops = new Set<number>();
  for (const cell of claimCells(root)) {
    tops.add(cell.offsetTop);
  }

  return tops.size + root.querySelectorAll('h2').length;
};

// The prototype measured about 2.6 claims to a line. 100 claims thus give about 40 lines.
// The floor is closed too: a ceiling alone passes when all the cells collapse onto one line.
export const AHundredClaimsReadInAboutFortyLines: Story = {
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const cells = claimCells(canvasElement);
    await expect(cells).toHaveLength(100);

    const lines = await linesOnThePage(canvasElement);
    // The measurement gave 41 lines, and the band is 34 to 46.
    await expect(lines).toBeGreaterThanOrEqual(34);
    await expect(lines).toBeLessThanOrEqual(46);
  },
};

export const AtTwentyFourRemOneClaimTakesOneLine: Story = {
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="w-96 p-2">
      <EntityRecord {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;

    const cells = claimCells(canvasElement);
    const tops = new Set<number>();
    for (const cell of cells) {
      tops.add(cell.offsetTop);
    }

    await expect(tops.size).toBe(cells.length);
  },
};

// The probe holds one claim with no source, so the count is 99 of 100.
export const EveryClaimCarriesAMarkToItsSource: Story = {
  parameters: { layout: 'fullscreen' },
  play: async ({ canvas, canvasElement }) => {
    const cells = claimCells(canvasElement);

    let marked = 0;
    for (const cell of cells) {
      if (cell.querySelector('button') !== null) marked += 1;
    }

    await expect(marked).toBe(cells.length - 1);
    await expect(canvas.getByText(/No source recorded/)).toBeInTheDocument();
  },
};

export const TheRecordDrawsNoInventedHeading: Story = {
  parameters: { layout: 'fullscreen' },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('heading')).toBeNull();
  },
};
