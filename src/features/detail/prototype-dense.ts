/**
 * **PROTOTYPE — the density probe.** The operator says a real node carries more than a hundred
 * values. The sample of #46 carries three, so no layout can be judged on it.
 *
 * This file invents one entity with 120 claims and 30 documents. **Every row is nonsense**, and
 * it is here to measure the screen, not to say anything about the world. It is deleted with the
 * rest of the prototype. It lives inside the feature, so `src/shared/fixtures/` is untouched and
 * the other three prototypes see nothing of it.
 *
 * It is reached at `/entity/probe-dense`.
 */

import type { Attribute, DocumentRow, Entity } from '@/shared/fixtures/types';

export const DENSE_ENTITY_ID = 'probe-dense';

const RATINGS = ['A1', 'A2', 'B2', 'B3', 'C2', 'C4', 'D4', 'D5', 'E5', 'F6'] as const;
const ORIGINS = ['machine', 'arbitrated', 'human'] as const;
const KINDS = ['file', 'url', 'api', 'report'] as const;

function docId(index: number): string {
  return `probe_doc_${String(index).padStart(2, '0')}`;
}

export const denseDocuments: readonly DocumentRow[] = Array.from({ length: 30 }, (_unused, at) => {
  // Every fifth document has no rating, so the unrated case is met while scrolling and not only
  // at the top of the list.
  const unrated = at % 5 === 4;
  const kind = KINDS[at % KINDS.length] ?? 'file';

  return {
    id: docId(at + 1),
    kind,
    title: `Probe document ${at + 1} — ${kind} record of the measurement set`,
    uri: at % 7 === 3 ? null : `https://example.invalid/probe/${docId(at + 1)}`,
    archiveUri: at % 7 === 3 ? null : `https://web.archive.example.invalid/2026/${docId(at + 1)}`,
    sha256: `${String(at + 1).padStart(2, '0')}b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f`,
    retrievedAt: `2026-0${(at % 8) + 1}-1${at % 10}`,
    admiralty: unrated ? null : (RATINGS[at % RATINGS.length] ?? null),
    admiraltyOrigin: unrated ? null : (ORIGINS[at % ORIGINS.length] ?? null),
  };
});

const STEMS = [
  'draught_m',
  'beam_m',
  'gross_tonnage',
  'net_tonnage',
  'keel_laid_on',
  'delivered_on',
  'class_society',
  'ice_class_held',
  'last_survey_on',
  'next_survey_on',
  'crew_count',
  'flag_state',
  'call_sign',
  'mmsi',
  'hull_material',
  'engine_maker',
  'engine_power_kw',
  'service_speed_kn',
  'bunker_capacity_t',
  'ballast_capacity_t',
  'holds_count',
  'cranes_fitted',
  'scrubber_fitted',
  'last_port_call',
  'insurer_named',
];

function valueFor(at: number, key: string): Attribute['v'] {
  switch (at % 6) {
    case 0:
      return 1000 + at * 37;
    case 1:
      return `2026-0${(at % 8) + 1}-2${at % 10}`;
    case 2:
      return at % 3 === 0;
    case 3:
      return [`code ${at}`, `code ${at + 1}`, `code ${at + 2}`];
    case 4:
      return `A long note on ${key}, written to see what a line does when the value is far wider than the box that holds it.`;
    default:
      return `value ${at} of ${key}`;
  }
}

const denseAttrs: Record<string, Attribute> = {};

for (let at = 0; at < 120; at += 1) {
  const stem = STEMS[at % STEMS.length] ?? 'value';
  const key = at < STEMS.length ? stem : `${stem}_${Math.floor(at / STEMS.length) + 1}`;
  // One claim in four cites two documents, which is the S1 case, spread through the whole list.
  const first = docId((at % 30) + 1);
  const second = docId(((at * 7) % 30) + 1);
  denseAttrs[key] = {
    v: valueFor(at, key),
    src: at % 4 === 0 && second !== first ? [first, second] : [first],
  };
}

export const denseEntity: Entity = {
  id: DENSE_ENTITY_ID,
  type: 'vessel',
  label: 'Density probe — 120 claims, 30 documents',
  attrs: denseAttrs,
  sources: [docId(1)],
  geom: { lon: 4.0361, lat: 51.9553 },
  promotedFrom: 'probe-proposal-0001',
};
