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

/**
 * 100 claims in about 40 lines on the page, and one to a line at 24 rem.
 *
 * **Every row below is invented**, as `src/shared/fixtures/corpus.ts` says of its own rows. The
 * committed fixture carries three claims on its largest entity, and the density cannot be
 * measured on three claims, so this file builds the density probe itself. **Nothing outside this
 * file reads it**: a second module that holds the shape of the read is the fault the skill
 * forbids, and this probe dies with the story.
 *
 * The keys are the ones the group rules of `./claims` match, so the groups on the screen are
 * the ones an analyst would meet. The story calls `readDossier`, which is what the page calls.
 *
 * **The probe is built by a plain loop.** It once used `Object.fromEntries` over a `flatMap` of
 * three `.map` calls. A story that generates a fixture must compute something, and the count is
 * held as low as the fixture allows.
 */

const PER_FAMILY = 15;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Four documents in rotation, and one that exactly one claim cites. */
const CITED: readonly DocId[] = ['doc-registry', 'doc-class', 'doc-survey', 'doc-broker'];

const cite = (n: number): readonly DocId[] => [CITED[n % CITED.length] ?? 'doc-registry'];

/**
 * Invariant 1: every claim carries at least one source. This one key carries none, so
 * the probe holds the fault that `./mark` must report in words. **Without it the mark story
 * compares 100 to 100 by construction and cannot fail.**
 */
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

/** Five families of numbered claims. Each one carries the prefix its group rule matches. */
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

/**
 * The lines the claims occupy **on the page**, headings included.
 *
 * A line of cells is one distinct `offsetTop` among the claim cells. A group heading is
 * `basis-full` and takes a line of its own, and the criterion is "on the page", so each heading
 * counts.
 *
 * **`document.fonts.ready` is awaited first.** The theme declares `Roboto Condensed` and
 * `JetBrains Mono`. The day either one is installed, the text reflows after a measurement that
 * did not wait, and the story flakes.
 */
const linesOnThePage = async (root: HTMLElement): Promise<number> => {
  await document.fonts.ready;

  const tops = new Set<number>();
  for (const cell of claimCells(root)) {
    tops.add(cell.offsetTop);
  }

  return tops.size + root.querySelectorAll('h2').length;
};

/**
 * The prototype measured about 2.6 claims to a line, which puts 100 claims in about 40 lines.
 *
 * **The bound is closed at both ends.** The assertion was a ceiling alone, and a ceiling alone
 * passes when every cell collapses onto one line, which is the opposite failure and a worse one.
 * The floor states that the claims still flow.
 */
export const AHundredClaimsReadInAboutFortyLines: Story = {
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const cells = claimCells(canvasElement);
    await expect(cells).toHaveLength(100);

    const lines = await linesOnThePage(canvasElement);
    // The measured value was 41 with 9 group headings, which are now removed. The band is
    // "about 40".
    await expect(lines).toBeGreaterThanOrEqual(34);
    await expect(lines).toBeLessThanOrEqual(46);
  },
};

/**
 * The same component, with no second layout and no appearance prop, fills a 24 rem sidebar with
 * one claim to a line. Each cell is `grow min-w-0` and each basis is wider than the pane, so
 * every claim takes the whole line.
 */
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

/**
 * A claim never appears without a mark to its source, and no control hides the mark. The
 * one claim of the probe that carries no source says so in words, so the count below is 99 of
 * 100 and the story can fail.
 */
export const EveryClaimCarriesAMarkToItsSource: Story = {
  parameters: { layout: 'fullscreen' },
  play: async ({ canvas, canvasElement }) => {
    const cells = claimCells(canvasElement);

    let marked = 0;
    for (const cell of cells) {
      if (cell.querySelector('button') !== null) marked += 1;
    }

    await expect(marked).toBe(cells.length - 1);
    // The claim with no source is drawn, and the absence is said in words. Never a dash, never
    // a blank: a surface that drops evidence in silence is worse than one that says what it
    // dropped.
    await expect(canvas.getByText(/No source recorded/)).toBeInTheDocument();
  },
};

/**
 * The record is one flat list, and it carries no heading of its own.
 *
 * **The group headings are removed.** Their names — `Identity`, `Ownership`, `Other` — were
 * invented in `./claims` from the prefix of a key, and no data supplies them. The tracker owns
 * any real group.
 */
export const TheRecordDrawsNoInventedHeading: Story = {
  parameters: { layout: 'fullscreen' },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('heading')).toBeNull();
  },
};
