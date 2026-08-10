/**
 * THROWAWAY PROTOTYPE — #39. Delete it when the visual language is chosen.
 *
 * It answers one question: which visual language does Gabriel use? It decides nothing on its
 * own; the operator picks, and an ADR records the pick.
 *
 * Round 2. The operator chose the **Grid** language of round 1 and reported that the text was
 * too weak against the ground. That was correct and it was measurable: the label token gave a
 * contrast ratio of 2.6:1, where readable text needs 4.5:1. All four variants below are the
 * same Grid language. **Only the contrast ladder and the ground change.**
 *
 * Every palette is a set of numbers, not a string, so this file computes the real WCAG ratio
 * of each pair and prints it in the bar at the foot. The choice is therefore evidenced and not
 * asserted.
 *
 * The screen is the W5–W6 review surface, which `prd.md` §3 names as the step that decides the
 * value of the whole system.
 *
 * Reach it at `/prototype?v=1` … `?v=4`.
 *
 * It touches no shared file. Every colour, size and typeface is local to this file, so
 * `src/index.css` stays untouched until the choice is made.
 */
import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

type VariantId = 1 | 2 | 3 | 4;

function isVariantId(value: number): value is VariantId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export const Route = createFileRoute('/prototype')({
  component: Prototype,
  validateSearch: (search: Record<string, unknown>): { v: VariantId } => {
    // The router parses a search value before this runs, so `?v=2` arrives as the number 2 and
    // not as the string '2'. Both forms are accepted.
    const raw = search['v'];
    let parsed = 1;
    if (typeof raw === 'number') {
      parsed = raw;
    } else if (typeof raw === 'string') {
      parsed = Number.parseInt(raw, 10);
    }
    return { v: isVariantId(parsed) ? parsed : 1 };
  },
});

/* --------------------------------------------------------------------------- the measure --- */

interface Oklch {
  l: number;
  c: number;
  h: number;
}

function ok(l: number, c: number, h: number): Oklch {
  return { l, c, h };
}

function css(colour: Oklch): string {
  return `oklch(${colour.l} ${colour.c} ${colour.h})`;
}

/** oklch to linear sRGB, then the WCAG relative luminance of it. */
function luminance(colour: Oklch): number {
  const rad = (colour.h * Math.PI) / 180;
  const a = colour.c * Math.cos(rad);
  const b = colour.c * Math.sin(rad);
  const lc = (colour.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (colour.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (colour.l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number): number => Math.min(1, Math.max(0, x));
  const r = clamp(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc);
  const g = clamp(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc);
  const bl = clamp(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(front: Oklch, back: Oklch): number {
  const x = luminance(front);
  const y = luminance(back);
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ the four ladders --- */

interface Palette {
  bg: Oklch;
  zebra: Oklch;
  fg: Oklch;
  dim: Oklch;
  faint: Oklch;
  line: Oklch;
  edge: Oklch;
  accent: Oklch;
  accentFg: Oklch;
  cand: Oklch;
  diss: Oklch;
}

interface Variant {
  id: VariantId;
  name: string;
  note: string;
  /** `color-scheme` decides the paint of every native control: the scrollbar, the caret, the
   *  focus ring, a date picker. Without it the browser draws a light scrollbar on a dark page.
   *  #39 records this gap. */
  scheme: 'dark' | 'light';
  palette: Palette;
}

const VARIANTS: Record<VariantId, Variant> = {
  1: {
    id: 1,
    name: 'Measured',
    note: 'The ground of round 1, kept. Only the text ladder is raised until every pair passes.',
    scheme: 'dark',
    palette: {
      bg: ok(0.16, 0.012, 215),
      zebra: ok(0.195, 0.012, 215),
      fg: ok(0.94, 0.008, 215),
      dim: ok(0.75, 0.008, 215),
      faint: ok(0.63, 0.008, 215),
      line: ok(0.32, 0.012, 215),
      edge: ok(0.5, 0.008, 215),
      accent: ok(0.74, 0.16, 45),
      accentFg: ok(0.16, 0.012, 215),
      cand: ok(0.82, 0.13, 82),
      diss: ok(0.7, 0.17, 28),
    },
  },
  2: {
    id: 2,
    name: 'Deep',
    note: 'A near-black ground. The strongest separation of text from the page.',
    scheme: 'dark',
    palette: {
      bg: ok(0.12, 0.012, 215),
      zebra: ok(0.155, 0.012, 215),
      fg: ok(0.96, 0.008, 215),
      dim: ok(0.77, 0.008, 215),
      faint: ok(0.62, 0.008, 215),
      line: ok(0.29, 0.012, 215),
      edge: ok(0.48, 0.008, 215),
      accent: ok(0.74, 0.16, 45),
      accentFg: ok(0.12, 0.012, 215),
      cand: ok(0.82, 0.13, 82),
      diss: ok(0.7, 0.17, 28),
    },
  },
  3: {
    id: 3,
    name: 'Slate',
    note: 'A lighter ground. Less harsh over a long session, and a stronger border.',
    scheme: 'dark',
    palette: {
      bg: ok(0.22, 0.012, 215),
      zebra: ok(0.255, 0.012, 215),
      fg: ok(0.96, 0.008, 215),
      dim: ok(0.79, 0.008, 215),
      faint: ok(0.67, 0.008, 215),
      line: ok(0.36, 0.012, 215),
      edge: ok(0.55, 0.008, 215),
      accent: ok(0.78, 0.15, 45),
      accentFg: ok(0.22, 0.012, 215),
      cand: ok(0.84, 0.12, 82),
      diss: ok(0.74, 0.16, 28),
    },
  },
  4: {
    id: 4,
    name: 'Daylight',
    note: 'The same language on paper. It answers whether a light theme is wanted at all.',
    scheme: 'light',
    palette: {
      bg: ok(0.975, 0.003, 230),
      zebra: ok(0.945, 0.004, 230),
      fg: ok(0.2, 0.01, 230),
      dim: ok(0.4, 0.01, 230),
      faint: ok(0.5, 0.01, 230),
      line: ok(0.86, 0.006, 230),
      edge: ok(0.62, 0.008, 230),
      accent: ok(0.52, 0.16, 42),
      accentFg: ok(0.985, 0.003, 230),
      cand: ok(0.5, 0.12, 70),
      diss: ok(0.48, 0.18, 28),
    },
  },
};

/** The pairs that must pass, and the minimum each one needs. */
const CHECKS: { label: string; front: keyof Palette; back: keyof Palette; min: number }[] = [
  { label: 'text', front: 'fg', back: 'bg', min: 4.5 },
  { label: 'data', front: 'dim', back: 'bg', min: 4.5 },
  { label: 'label', front: 'faint', back: 'bg', min: 4.5 },
  { label: 'label/zebra', front: 'faint', back: 'zebra', min: 4.5 },
  { label: 'border', front: 'edge', back: 'bg', min: 3 },
  { label: 'accent', front: 'accent', back: 'bg', min: 4.5 },
  { label: 'candidate', front: 'cand', back: 'bg', min: 4.5 },
  { label: 'dissent', front: 'diss', back: 'bg', min: 4.5 },
  { label: 'on accent', front: 'accentFg', back: 'accent', min: 4.5 },
];

/* ------------------------------------------------------------------------------ the data --- */

interface Vote {
  agent: string;
  verdict: 'accept' | 'reject' | 'abstain';
  confidence: number;
}

interface Attribute {
  key: string;
  value: string;
  source: string;
  mono: boolean;
}

interface Neighbour {
  relation: string;
  name: string;
  type: string;
  hue: number;
}

interface Proposal {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  admiralty: string;
  dissent: boolean;
  extracted: string;
  document: string;
  page: number;
  before: string;
  hit: string;
  after: string;
  attributes: Attribute[];
  votes: Vote[];
  neighbours: Neighbour[];
}

const BASE: Proposal[] = [
  {
    id: 'PR-4182',
    subject: 'Meridian Shipping Ltd',
    predicate: 'owns',
    object: 'MV Castellan',
    confidence: 0.42,
    admiralty: 'C3',
    dissent: true,
    extracted: '2026-08-09 14:02',
    document: 'lloyds-registry-2025.pdf',
    page: 118,
    before: 'The registered owner of record for the vessel is given as ',
    hit: 'Meridian Shipping Ltd (Valletta)',
    after: ', with beneficial ownership undeclared at the time of survey.',
    attributes: [
      { key: 'imo', value: '9482173', source: 'lloyds-registry-2025.pdf', mono: true },
      { key: 'flag', value: 'Malta', source: 'lloyds-registry-2025.pdf', mono: false },
      { key: 'registered', value: '2019-03-11', source: 'mt-company-extract.pdf', mono: true },
      { key: 'tonnage_gt', value: '28 400', source: 'lloyds-registry-2025.pdf', mono: true },
      { key: 'last_port_call', value: 'Piraeus', source: 'ais-export-0731.csv', mono: false },
    ],
    votes: [
      { agent: 'extract-v4', verdict: 'accept', confidence: 0.71 },
      { agent: 'corroborate-v2', verdict: 'reject', confidence: 0.55 },
      { agent: 'resolve-v3', verdict: 'abstain', confidence: 0.3 },
    ],
    neighbours: [
      { relation: 'director of', name: 'A. Kowalczyk', type: 'Person', hue: 240 },
      { relation: 'registered at', name: 'Level 3, Valletta', type: 'Place', hue: 165 },
      { relation: 'owns', name: 'MV Castellan', type: 'Asset', hue: 30 },
      { relation: 'parent of', name: 'Meridian Bunkering', type: 'Org', hue: 95 },
    ],
  },
  {
    id: 'PR-4183',
    subject: 'A. Kowalczyk',
    predicate: 'director of',
    object: 'Meridian Shipping Ltd',
    confidence: 0.88,
    admiralty: 'B2',
    dissent: false,
    extracted: '2026-08-09 14:02',
    document: 'mt-company-extract.pdf',
    page: 2,
    before: 'Directors: ',
    hit: 'Andrzej Kowalczyk, appointed 11 March 2019',
    after: '; Secretary: Camilleri Corporate Services Ltd.',
    attributes: [
      { key: 'appointed', value: '2019-03-11', source: 'mt-company-extract.pdf', mono: true },
      { key: 'nationality', value: 'Poland', source: 'mt-company-extract.pdf', mono: false },
      { key: 'passport_partial', value: 'EK••••42', source: 'leak-2024-tranche-3', mono: true },
    ],
    votes: [
      { agent: 'extract-v4', verdict: 'accept', confidence: 0.92 },
      { agent: 'corroborate-v2', verdict: 'accept', confidence: 0.84 },
    ],
    neighbours: [
      { relation: 'director of', name: 'Meridian Shipping Ltd', type: 'Org', hue: 95 },
      { relation: 'located in', name: 'Gdańsk', type: 'Place', hue: 165 },
    ],
  },
  {
    id: 'PR-4185',
    subject: 'MV Castellan',
    predicate: 'called at',
    object: 'Port of Piraeus',
    confidence: 0.96,
    admiralty: 'A1',
    dissent: false,
    extracted: '2026-08-09 14:05',
    document: 'ais-export-0731.csv',
    page: 1,
    before: '9482173,2026-07-28T04:11Z,',
    hit: '37.9420,23.6260',
    after: ',moored,PIRAEUS ANCH B',
    attributes: [
      { key: 'lat', value: '37.9420', source: 'ais-export-0731.csv', mono: true },
      { key: 'lon', value: '23.6260', source: 'ais-export-0731.csv', mono: true },
      { key: 'observed', value: '2026-07-28T04:11Z', source: 'ais-export-0731.csv', mono: true },
      { key: 'status', value: 'moored', source: 'ais-export-0731.csv', mono: false },
    ],
    votes: [{ agent: 'extract-v4', verdict: 'accept', confidence: 0.96 }],
    neighbours: [
      { relation: 'owned by', name: 'Meridian Shipping Ltd', type: 'Org', hue: 95 },
      { relation: 'called at', name: 'Port of Piraeus', type: 'Place', hue: 165 },
    ],
  },
  {
    id: 'PR-4190',
    subject: 'Meridian Bunkering',
    predicate: 'same as',
    object: 'Meridian Bunkering SA',
    confidence: 0.31,
    admiralty: 'D4',
    dissent: true,
    extracted: '2026-08-09 14:11',
    document: 'panama-extract-1994.pdf',
    page: 7,
    before: 'Sociedad anónima constituida bajo el nombre ',
    hit: 'MERIDIAN BUNKERING S.A.',
    after: ', con domicilio en Ciudad de Panamá.',
    attributes: [
      { key: 'jurisdiction', value: 'Panama', source: 'panama-extract-1994.pdf', mono: false },
      { key: 'incorporated', value: '1994-11-02', source: 'panama-extract-1994.pdf', mono: true },
      { key: 'status', value: 'unknown', source: '—', mono: false },
    ],
    votes: [
      { agent: 'resolve-v3', verdict: 'accept', confidence: 0.44 },
      { agent: 'corroborate-v2', verdict: 'reject', confidence: 0.68 },
    ],
    neighbours: [{ relation: 'parent', name: 'Meridian Shipping Ltd', type: 'Org', hue: 95 }],
  },
  {
    id: 'PR-4191',
    subject: 'Camilleri Corporate Services Ltd',
    predicate: 'secretary of',
    object: 'Meridian Shipping Ltd',
    confidence: 0.79,
    admiralty: 'B3',
    dissent: false,
    extracted: '2026-08-09 14:12',
    document: 'mt-company-extract.pdf',
    page: 2,
    before: 'Secretary: ',
    hit: 'Camilleri Corporate Services Ltd',
    after: ', C 41182, of 3 Old Bakery Street, Valletta.',
    attributes: [
      { key: 'company_no', value: 'C 41182', source: 'mt-company-extract.pdf', mono: true },
      { key: 'role', value: 'corporate secretary', source: 'mt-company-extract.pdf', mono: false },
    ],
    votes: [{ agent: 'extract-v4', verdict: 'accept', confidence: 0.79 }],
    neighbours: [{ relation: 'secretary of', name: 'Meridian Shipping Ltd', type: 'Org', hue: 95 }],
  },
  {
    id: 'PR-4194',
    subject: 'Level 3, Valletta',
    predicate: 'address of',
    object: '41 other companies',
    confidence: 0.58,
    admiralty: 'C2',
    dissent: true,
    extracted: '2026-08-09 14:20',
    document: 'mt-registry-bulk-2026.csv',
    page: 1,
    before: 'address_normalised="3 OLD BAKERY ST VALLETTA",count=',
    hit: '41',
    after: ',first_seen=2011-06-04',
    attributes: [
      { key: 'occupants', value: '41', source: 'mt-registry-bulk-2026.csv', mono: true },
      { key: 'first_seen', value: '2011-06-04', source: 'mt-registry-bulk-2026.csv', mono: true },
      { key: 'kind', value: 'service address', source: '—', mono: false },
    ],
    votes: [
      { agent: 'extract-v4', verdict: 'accept', confidence: 0.62 },
      { agent: 'corroborate-v2', verdict: 'abstain', confidence: 0.4 },
      { agent: 'resolve-v3', verdict: 'reject', confidence: 0.51 },
    ],
    neighbours: [
      { relation: 'registered at', name: 'Meridian Shipping Ltd', type: 'Org', hue: 95 },
    ],
  },
];

// A real queue is long. Six rows made the pane look empty and hid the density, so the six are
// cycled to thirty. Only the identifier and the confidence move.
const PROPOSALS: Proposal[] = Array.from({ length: 5 }, (_, cycle) =>
  BASE.map((p, index) => ({
    ...p,
    id: cycle === 0 ? p.id : `PR-${4200 + cycle * 17 + index}`,
    confidence: Math.min(0.99, Math.max(0.06, p.confidence + (cycle - 2) * 0.07)),
  })),
).flat();

/* ----------------------------------------------------------------------------- the style --- */

function paletteRule(variant: Variant): string {
  const p = variant.palette;
  return `.proto[data-v='${variant.id}'] {
  color-scheme: ${variant.scheme};
  --p-bg: ${css(p.bg)};
  --p-zebra: ${css(p.zebra)};
  --p-fg: ${css(p.fg)};
  --p-dim: ${css(p.dim)};
  --p-faint: ${css(p.faint)};
  --p-line: ${css(p.line)};
  --p-edge: ${css(p.edge)};
  --p-accent: ${css(p.accent)};
  --p-accent-fg: ${css(p.accentFg)};
  --p-cand: ${css(p.cand)};
  --p-diss: ${css(p.diss)};
}`;
}

const STRUCTURE = `
.proto {
  --p-r: 0px;
  --p-row: 24px;
  --p-ctrl: 24px;
  --p-fs: 12px;
  --p-fs-s: 11px;
  --p-pad: 8px;
  --p-sans: 'Roboto Condensed', system-ui, sans-serif;
  --p-mono: 'JetBrains Mono', ui-monospace, monospace;
  --p-cap-ls: 0.06em;

  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  background: var(--p-bg);
  color: var(--p-fg);
  font-family: var(--p-sans);
  font-size: var(--p-fs);
  line-height: 1.35;
  font-variant-numeric: tabular-nums lining-nums;
  overflow: hidden;
}
.proto * { box-sizing: border-box; min-width: 0; }
.proto button { font: inherit; color: inherit; cursor: pointer; }

/* The scrollbar.
 *
 * The color-scheme property above already stops the browser from painting a light bar on a
 * dark page. It is not enough on its own: the native bar keeps its round thumb and its arrow
 * buttons, and both contradict a square, dense language.
 *
 * The bar stays visible at rest. It is not hidden until the pointer moves, because in a queue
 * of thirty rows the thumb is the only thing that says how much work is left.
 *
 * The thumb takes the label token, which measures 5.6:1 against the ground. The border token
 * at 3.2:1 is the minimum for a control, and it was too quiet here: the thumb is not only a
 * control, it is the only report of how much of the queue is left. The 2px border is the
 * ground colour, which insets the thumb inside the gutter without a radius and without a
 * second background.
 *
 * Chromium and WebKit read the block below. Firefox reads none of it, so the standard
 * properties follow, guarded: Chromium honours scrollbar-width above the webkit rules, and an
 * unguarded declaration would throw this whole block away. */
.proto ::-webkit-scrollbar { width: 10px; height: 10px; }
.proto ::-webkit-scrollbar-track { background: var(--p-bg); }
.proto ::-webkit-scrollbar-thumb { background: var(--p-faint); border: 2px solid var(--p-bg); }
.proto ::-webkit-scrollbar-thumb:hover { background: var(--p-fg); }
.proto ::-webkit-scrollbar-button { display: none; }
.proto ::-webkit-scrollbar-corner { background: var(--p-bg); }

@supports not selector(::-webkit-scrollbar) {
  .proto, .proto * { scrollbar-width: thin; scrollbar-color: var(--p-edge) var(--p-bg); }
}

.p-head {
  display: flex; align-items: center; gap: 16px;
  height: 32px; padding: 0 var(--p-pad);
  border-bottom: 1px solid var(--p-line);
}
.p-title { font-weight: 700; letter-spacing: var(--p-cap-ls); text-transform: uppercase; }
.p-crumb { color: var(--p-dim); }
.p-head-sp { margin-left: auto; }

.p-main { display: grid; grid-template-columns: 300px 1fr 340px; overflow: hidden; }
.p-pane { display: flex; flex-direction: column; overflow: hidden; }
.p-pane + .p-pane { border-left: 1px solid var(--p-line); }

.p-cap {
  display: flex; align-items: center; gap: 8px;
  height: 22px; padding: 0 var(--p-pad); flex: none;
  font-size: var(--p-fs-s); font-weight: 700;
  letter-spacing: var(--p-cap-ls); text-transform: uppercase;
  color: var(--p-faint); border-bottom: 1px solid var(--p-line);
}
.p-cap-n { margin-left: auto; font-family: var(--p-mono); font-weight: 400; }
.p-scroll { overflow: auto; flex: 1; }

.p-qrow {
  display: grid; grid-template-columns: 6px 1fr 26px 34px;
  align-items: center; gap: 6px;
  height: var(--p-row); padding: 0 var(--p-pad);
  border-bottom: 1px solid var(--p-line);
  cursor: pointer; text-align: left; width: 100%;
  background: transparent; border-left: 2px solid transparent;
}
.p-qrow:nth-child(even) { background: var(--p-zebra); }
.p-qrow:hover { background: color-mix(in oklch, var(--p-fg), var(--p-bg) 88%); }
.p-qrow[data-on='1'] {
  background: color-mix(in oklch, var(--p-fg), var(--p-bg) 82%);
  border-left-color: var(--p-accent);
}
.p-qtext { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.p-qsub { color: var(--p-fg); }
.p-qobj { color: var(--p-dim); }
.p-dot { width: 6px; height: 6px; background: transparent; }
.p-dot[data-on='1'] { background: var(--p-diss); }

.p-mono { font-family: var(--p-mono); font-size: var(--p-fs-s); }
.p-num { font-family: var(--p-mono); font-size: var(--p-fs-s); text-align: right; }

.p-body { padding: var(--p-pad); overflow: auto; }
.p-claim { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.p-s { font-size: 16px; font-weight: 700; }
.p-p { color: var(--p-dim); }

.p-badge {
  display: inline-flex; align-items: center; height: 17px; padding: 0 5px;
  border: 1px solid currentColor; border-radius: var(--p-r);
  font-family: var(--p-mono); font-size: var(--p-fs-s);
  letter-spacing: 0.04em; text-transform: uppercase;
}
.p-badge[data-k='cand'] { color: var(--p-cand); }
.p-badge[data-k='diss'] { color: var(--p-diss); }

.p-strip {
  display: grid; grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--p-line); border-radius: var(--p-r); margin-bottom: 10px;
}
.p-cell { padding: 6px var(--p-pad); border-left: 1px solid var(--p-line); }
.p-cell:first-child { border-left: none; }
.p-k {
  font-size: var(--p-fs-s); color: var(--p-faint);
  text-transform: uppercase; letter-spacing: var(--p-cap-ls);
}
.p-v { font-family: var(--p-mono); }

.p-bar { height: 4px; background: var(--p-line); border-radius: var(--p-r); margin-top: 5px; }
.p-bar > i { display: block; height: 100%; background: var(--p-cand); }
.p-bar[data-high='1'] > i { background: var(--p-dim); }

table.p-t { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.p-t th {
  height: 20px; padding: 0 6px; text-align: left;
  font-size: var(--p-fs-s); font-weight: 700; color: var(--p-faint);
  text-transform: uppercase; letter-spacing: var(--p-cap-ls);
  border-bottom: 1px solid var(--p-edge);
}
.p-t td {
  height: var(--p-row); padding: 0 6px;
  border-bottom: 1px solid var(--p-line);
  border-left: 1px solid var(--p-line);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 0;
}
.p-t td:first-child, .p-t th:first-child { border-left: none; }
.p-t tbody tr:nth-child(even) { background: var(--p-zebra); }
.p-t td.r, .p-t th.r { text-align: right; }
.p-t td.dimmed { color: var(--p-dim); }

.p-actions { display: flex; gap: 6px; align-items: center; padding-top: 4px; }
.p-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: var(--p-ctrl); padding: 0 10px;
  background: transparent; color: var(--p-fg);
  border: 1px solid var(--p-edge); border-radius: var(--p-r);
}
.p-btn:hover { background: color-mix(in oklch, var(--p-fg), var(--p-bg) 88%); }
.p-btn[data-pri='1'] {
  background: var(--p-accent); color: var(--p-accent-fg);
  border-color: var(--p-accent); font-weight: 700;
}
.p-btn[data-danger='1'] { color: var(--p-diss); border-color: var(--p-diss); }
.p-key {
  font-family: var(--p-mono); font-size: var(--p-fs-s); color: inherit; opacity: 0.75;
  border: 1px solid currentColor; border-radius: var(--p-r); padding: 0 3px;
}

.p-quote { padding: var(--p-pad); border-bottom: 1px solid var(--p-line); }
/* A file name is data. It keeps its own case, so it does not take the label rule above. */
.p-file { color: var(--p-dim); }
.p-passage {
  font-family: var(--p-mono); font-size: var(--p-fs); line-height: 1.65; color: var(--p-fg);
}
.p-hit { box-shadow: inset 0 -2px 0 0 var(--p-accent); }

.p-nrow {
  display: grid; grid-template-columns: 3px 92px 1fr 46px; gap: 8px; align-items: center;
  height: var(--p-row); padding: 0 var(--p-pad);
  border-bottom: 1px solid var(--p-line);
}
.p-nrow:nth-child(even) { background: var(--p-zebra); }
.p-swatch { width: 3px; height: 13px; }
.p-nrel { color: var(--p-faint); font-size: var(--p-fs-s); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.p-nname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.p-ntype { font-size: var(--p-fs-s); color: var(--p-faint); text-align: right; }

.p-foot {
  display: flex; align-items: center; gap: 14px;
  height: 22px; padding: 0 var(--p-pad);
  border-top: 1px solid var(--p-line);
  font-size: var(--p-fs-s); color: var(--p-faint);
}

.p-switch {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 10px;
  background: oklch(0.11 0 0); color: oklch(0.95 0 0);
  font: 11px/1.4 ui-monospace, monospace;
}
.p-switch button {
  height: 22px; padding: 0 9px; border-radius: 0;
  background: transparent; color: oklch(0.8 0 0);
  border: 1px solid oklch(0.42 0 0);
}
.p-switch button[data-on='1'] { background: oklch(0.95 0 0); color: oklch(0.11 0 0); border-color: oklch(0.95 0 0); }
.p-switch em { font-style: normal; color: oklch(0.75 0 0); }
.p-ratio { color: oklch(0.75 0 0); }
.p-ratio b { color: oklch(0.95 0 0); font-weight: 400; }
.p-ratio[data-fail='1'] b { color: oklch(0.72 0.18 28); }
`;

const SHEET = [
  "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Roboto+Condensed:wght@400;500;700&display=swap');",
  ...Object.values(VARIANTS).map(paletteRule),
  STRUCTURE,
].join('\n');

/* ------------------------------------------------------------------------------ the view --- */

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function Prototype() {
  const { v } = Route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState('PR-4182');

  const variant = VARIANTS[v];
  const current = PROPOSALS.find((p) => p.id === selected);
  const dissenting = PROPOSALS.filter((p) => p.dissent).length;

  return (
    <>
      <style>{SHEET}</style>
      <div className="proto" data-v={v}>
        <header className="p-head">
          <span className="p-title">Review</span>
          <span className="p-crumb p-mono">
            queue {PROPOSALS.length} · dissent {dissenting} · promoted today 12
          </span>
          <span className="p-head-sp p-mono p-crumb">gabriel · candidate layer</span>
        </header>

        <div className="p-main">
          {/* the queue */}
          <section className="p-pane">
            <div className="p-cap">
              <span>Queue</span>
              <span className="p-cap-n">{PROPOSALS.length}</span>
            </div>
            <div className="p-scroll">
              {PROPOSALS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="p-qrow"
                  data-on={p.id === selected ? '1' : '0'}
                  onClick={() => {
                    setSelected(p.id);
                  }}
                >
                  <span className="p-dot" data-on={p.dissent ? '1' : '0'} />
                  <span className="p-qtext">
                    <span className="p-qsub">{p.subject}</span>{' '}
                    <span className="p-qobj">
                      {p.predicate} {p.object}
                    </span>
                  </span>
                  <span className="p-num">{p.admiralty}</span>
                  <span className="p-num">{pct(p.confidence)}</span>
                </button>
              ))}
            </div>
          </section>

          {/* the proposal */}
          <section className="p-pane">
            <div className="p-cap">
              <span>Proposal</span>
              <span className="p-cap-n">{current ? current.id : '—'}</span>
            </div>
            {current ? (
              <div className="p-body">
                <div className="p-claim">
                  <span className="p-s">{current.subject}</span>
                  <span className="p-p">{current.predicate}</span>
                  <span className="p-s">{current.object}</span>
                  <span className="p-badge" data-k="cand">
                    candidate
                  </span>
                  {current.dissent && (
                    <span className="p-badge" data-k="diss">
                      dissent
                    </span>
                  )}
                </div>

                <div className="p-strip">
                  <div className="p-cell">
                    <div className="p-k">confidence</div>
                    <div className="p-v">{pct(current.confidence)}</div>
                    <div className="p-bar" data-high={current.confidence > 0.75 ? '1' : '0'}>
                      <i style={{ width: pct(current.confidence) }} />
                    </div>
                  </div>
                  <div className="p-cell">
                    <div className="p-k">admiralty</div>
                    <div className="p-v">{current.admiralty}</div>
                  </div>
                  <div className="p-cell">
                    <div className="p-k">extracted</div>
                    <div className="p-v">{current.extracted}</div>
                  </div>
                  <div className="p-cell">
                    <div className="p-k">identifier</div>
                    <div className="p-v">{current.id}</div>
                  </div>
                </div>

                <table className="p-t">
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>attribute</th>
                      <th>value</th>
                      <th style={{ width: '38%' }}>source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.attributes.map((a) => (
                      <tr key={a.key}>
                        <td className="p-mono">{a.key}</td>
                        <td className={a.mono ? 'p-mono' : ''}>{a.value}</td>
                        <td className="p-mono dimmed">{a.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <table className="p-t">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>agent</th>
                      <th>verdict</th>
                      <th className="r" style={{ width: '20%' }}>
                        confidence
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.votes.map((vote) => (
                      <tr key={vote.agent}>
                        <td className="p-mono">{vote.agent}</td>
                        <td
                          className={vote.verdict === 'reject' ? '' : 'dimmed'}
                          style={vote.verdict === 'reject' ? { color: 'var(--p-diss)' } : undefined}
                        >
                          {vote.verdict}
                        </td>
                        <td className="p-num">{pct(vote.confidence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="p-actions">
                  <button type="button" className="p-btn" data-pri="1">
                    Promote <span className="p-key">↵</span>
                  </button>
                  <button type="button" className="p-btn" data-danger="1">
                    Reject <span className="p-key">R</span>
                  </button>
                  <button type="button" className="p-btn">
                    Edit <span className="p-key">E</span>
                  </button>
                  <button type="button" className="p-btn">
                    Skip <span className="p-key">S</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-body p-crumb">No proposal is selected.</div>
            )}
          </section>

          {/* the source and the neighbourhood */}
          <section className="p-pane">
            <div className="p-cap">
              <span>Source</span>
              <span className="p-cap-n">M8</span>
            </div>
            {current ? (
              <div className="p-scroll">
                <div className="p-quote">
                  <div className="p-mono p-file" style={{ marginBottom: 6 }}>
                    {current.document} · p.{current.page}
                  </div>
                  <p className="p-passage">
                    {current.before}
                    <span className="p-hit">{current.hit}</span>
                    {current.after}
                  </p>
                </div>
                <div className="p-cap">
                  <span>Neighbourhood</span>
                  <span className="p-cap-n">{current.neighbours.length}</span>
                </div>
                {current.neighbours.map((n) => (
                  <div className="p-nrow" key={`${n.relation}-${n.name}`}>
                    <span
                      className="p-swatch"
                      style={{ background: `oklch(0.74 0.13 ${n.hue})` }}
                    />
                    <span className="p-nrel">{n.relation}</span>
                    <span className="p-nname">{n.name}</span>
                    <span className="p-ntype">{n.type}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <footer className="p-foot">
          <span>
            <span className="p-mono">↑↓</span> move
          </span>
          <span>
            <span className="p-mono">↵</span> promote
          </span>
          <span>
            <span className="p-mono">R</span> reject
          </span>
          <span>
            <span className="p-mono">G</span> open in graph
          </span>
          <span style={{ marginLeft: 'auto' }} className="p-mono">
            read-only · gabriel_read
          </span>
        </footer>

        {/* The switcher and the measure. Neither belongs to the design; both belong to the
            prototype. Every ratio below is computed from the palette above, at render. */}
        <div className="p-switch">
          {Object.values(VARIANTS).map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              data-on={candidate.id === v ? '1' : '0'}
              onClick={() => {
                void navigate({ to: '/prototype', search: { v: candidate.id } });
              }}
            >
              {candidate.id} {candidate.name}
            </button>
          ))}
          <em>{variant.note}</em>
          <span style={{ flexBasis: '100%' }} />
          {CHECKS.map((check) => {
            const value = contrast(variant.palette[check.front], variant.palette[check.back]);
            return (
              <span className="p-ratio" key={check.label} data-fail={value < check.min ? '1' : '0'}>
                {check.label} <b>{value.toFixed(1)}</b>
              </span>
            );
          })}
          <span className="p-ratio">— minimum 4.5 for text, 3.0 for a border</span>
        </div>
      </div>
    </>
  );
}
