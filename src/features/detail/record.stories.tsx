import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { useState } from 'react';

import type {
  Attribute,
  AttributeValue,
  Attributes,
  Corpus,
  DocId,
  DocumentRow,
  Vocabulary,
} from '@/shared/read/model';

import { recordCells, typedInto, type Drafts } from './draft';
import { readDossier, type RecordRow, type SourceRef } from './dossier';
import { SourceMark } from './mark';
import { EntityRecord, type EntityRecordProps } from './record';

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
      proposedType: null,
      label: 'Northern Aurora',
      attrs: probeAttributes(),
      sources: ['doc-registry'],
      geom: null,
      promotedFrom: 'proposal-probe-1',
    },
  ],
  relations: [],
  proposals: [],
};

// No key of this probe is declared, so the record is read through and never written here.
const ROWS: readonly RecordRow[] = readDossier(CORPUS, 'probe-1', [])?.rows ?? [];

const onSelectSource = fn();

const mark = (sources: readonly SourceRef[]) => (
  <SourceMark sources={sources} activeSource={null} onSelectSource={onSelectSource} />
);

/** The arm the args of this file state. A story of the other arm renders it, and takes no args. */
type Reading = Extract<EntityRecordProps, { mode: 'reading' }>;

const meta = {
  component: EntityRecord,
  args: { mode: 'reading', cells: recordCells(ROWS, null), mark },
  // The width of the pane is part of the contract, so each story states it.
  render: (args) => (
    <div className="w-[1200px] p-2">
      <EntityRecord {...args} />
    </div>
  ),
} satisfies Meta<Reading>;

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

  return tops.size;
};

// The claims flow at about 3.4 to a line, so 100 claims give about 30 lines.
// The floor is closed too: a ceiling alone passes when all the cells collapse onto one line.
export const AHundredClaimsReadInAboutThirtyLines: Story = {
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const cells = claimCells(canvasElement);
    await expect(cells).toHaveLength(100);

    const lines = await linesOnThePage(canvasElement);
    // The measurement gave 29 lines, and the band is 24 to 33.
    await expect(lines).toBeGreaterThanOrEqual(24);
    await expect(lines).toBeLessThanOrEqual(33);
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

/** A note is declared as a note. Before, the control was read from the length of the value, and
 * the 49th character changed it: React then replaced the element and the caret was lost. */
const NOTE_KEY = 'hull_note';

const NOTE_START = 'Pitting in way of the number three hold';

const NOTE_ADDED = ', and the frames aft of it';

const DECLARED: Vocabulary = [
  { key: NOTE_KEY, kind: 'note', label: 'Hull note', unit: null, pattern: null, retired: false },
];

const NOTE_CORPUS: Corpus = {
  documents: [document_('doc-survey', 'Survey report, 2025')],
  entities: [
    {
      id: 'probe-note',
      type: 'vessel',
      proposedType: null,
      label: 'Northern Aurora',
      attrs: { [NOTE_KEY]: { v: NOTE_START, src: ['doc-survey'] } },
      sources: ['doc-survey'],
      geom: null,
      promotedFrom: 'proposal-probe-note',
    },
  ],
  relations: [],
  proposals: [],
};

const NOTE_ROWS: readonly RecordRow[] =
  readDossier(NOTE_CORPUS, 'probe-note', DECLARED)?.rows ?? [];

/** The record with the state a page holds for it. A story drives what a page drives. */
function WritableRecord({ rows }: { rows: readonly RecordRow[] }) {
  const [drafts, setDrafts] = useState<Drafts>(() => new Map());

  return (
    <div className="w-[1200px] p-2">
      <EntityRecord
        mode="writing"
        cells={recordCells(rows, drafts)}
        mark={mark}
        onEdit={(key, typed) => {
          setDrafts(typedInto(rows, drafts, key, typed));
        }}
      />
    </div>
  );
}

export const TheCaretSurvivesThePastTheOldBoundary: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <WritableRecord rows={NOTE_ROWS} />,
  play: async ({ canvas }) => {
    const box = canvas.getByLabelText('Hull note');
    if (!(box instanceof HTMLInputElement)) throw new Error('The note draws no text control');

    await userEvent.click(box);
    await userEvent.type(box, NOTE_ADDED);

    const whole = `${NOTE_START}${NOTE_ADDED}`;
    // The value passes 48 characters, which was the boundary the control used to be read from.
    await expect(whole.length).toBeGreaterThan(48);
    await expect(box).toHaveValue(whole);
    await expect(box).toHaveFocus();
    await expect(box.selectionStart).toBe(whole.length);
  },
};

// A key the vocabulary does not declare takes no value, and the record says so in words.
export const AnUndeclaredKeyIsReadOnlyAndSaysWhy: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <WritableRecord rows={ROWS} />,
  play: async ({ canvas }) => {
    const box = canvas.getByLabelText('Imo number');
    await expect(box).toBeDisabled();
    await expect(
      canvas.getAllByText('The vocabulary declares no such key, and it takes no value here.')
        .length,
    ).toBe(100);
  },
};
