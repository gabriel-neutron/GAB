// The check door reads the stored readings and the stored text, and it writes each result itself.
// Each gesture runs inside a transaction that rolls back, so the census tests count the same rows.

import { expect, test } from 'vitest';
import { z } from 'zod';

import {
  aCall,
  aClaim,
  aDocument,
  aJob,
  anEntity,
  aPair,
  aReading,
  aRelation,
  asRole,
  endJob,
  runChecks,
  spanOf,
  storedCheck,
  type CheckRow,
  type Pair,
  type PairSeed,
} from './evidence-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const NAYARA = 'Nayara Star';
const SENTENCE = 'The tanker Nayara Star (IMO 9123453) left Sikka on 3 May 2026.';
const PAGE = `Port bulletin of 4 May 2026. ${SENTENCE} The crew is safe.`;

const NEW_VESSEL = { type: 'vessel', label: NAYARA, attrs: { imo: '9123453' } };

const only = (rows: readonly CheckRow[]): CheckRow => {
  const [row] = rows;
  if (row === undefined) throw new Error('the door returned no row');
  return row;
};

const checked = async (
  seed: Omit<PairSeed, 'span'> & { readonly span?: PairSeed['span'] },
  then?: (ask: Ask, pair: Pair) => Promise<void>,
): Promise<{ row: CheckRow; stored: Readonly<Record<string, unknown>> }> =>
  rolledBack('superuser', async (ask) => {
    const pair = await aPair(ask, { ...seed, span: seed.span ?? spanOf(seed.page, SENTENCE) });
    if (then !== undefined) await then(ask, pair);
    const row = only(await runChecks(ask, pair.evidence, pair.claim));
    return { row, stored: await storedCheck(ask, row.check_id) };
  });

// ----------------------------------------------------------------------- the span check ---

test('a span that holds the subject and the value passes and counts', async () => {
  const { row } = await checked({ page: PAGE, payload: NEW_VESSEL });
  expect(row).toMatchObject({
    span_result: 'pass',
    support: 'value',
    counts: true,
    identity: 'not_needed',
    held: {},
    same_family: 'false',
  });
});

test('a span that names only the subject supports the name, and the claim with a value counts 0', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: NEW_VESSEL,
    span: spanOf(PAGE, 'The tanker Nayara Star'),
  });
  expect(row).toMatchObject({ support: 'name_only', counts: false });
});

test('a span that names only the subject supports a claim that is the name alone', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: { type: 'vessel', label: NAYARA },
    span: spanOf(PAGE, 'The tanker Nayara Star'),
  });
  expect(row).toMatchObject({ support: 'name_only', counts: true });
});

test('a span that is not in the live text of the document counts 0', async () => {
  const page = `Port bulletin. ${'\uFFFC'.repeat(40)} The crew is safe.`;
  const { row, stored } = await checked({
    page,
    payload: NEW_VESSEL,
    span: { start: 15, end: 55 },
  });
  expect(row).toMatchObject({ span_result: 'fail', counts: false });
  expect(stored['hidden_text']).toBe(true);
});

test('a span that touches hidden text fails, and the hidden text is flagged', async () => {
  const page = `Port bulletin. The tanker Nayara Star (IMO 9123453) left Sikka${'\uFFFC'.repeat(5)}.`;
  const { row, stored } = await checked({
    page,
    payload: NEW_VESSEL,
    span: { start: 15, end: Array.from(page).length },
  });
  expect(row).toMatchObject({ span_result: 'fail', counts: false });
  expect(stored['hidden_text']).toBe(true);
});

test('a span after a character outside the basic plane passes with offsets in code points', async () => {
  const page = `\u{1F6A2} Port bulletin. ${SENTENCE}`;
  const { row } = await checked({ page, payload: NEW_VESSEL, span: spanOf(page, SENTENCE) });
  expect(row).toMatchObject({ span_result: 'pass', counts: true });
});

test('a span that names only a child unit does not support the position of the parent', async () => {
  const page = 'The 2nd Battalion arrived in Kursk on 3 May 2026.';
  const { row } = await checked({
    page,
    payload: { type: 'military_unit', label: '1st Tank Army', attrs: { location: 'Kursk' } },
    span: spanOf(page, page),
  });
  expect(row).toMatchObject({ support: 'none', counts: false });
});

test('a negation between the subject and the value fails the span', async () => {
  const page = 'The tanker Nayara Star did not leave Sikka on 3 May 2026.';
  const { row } = await checked({
    page,
    payload: { type: 'vessel', label: NAYARA, attrs: { last_port: 'Sikka' } },
    span: spanOf(page, page),
  });
  expect(row).toMatchObject({ span_result: 'fail', counts: false });
});

test('a span over two table rows fails', async () => {
  const page = '| Nayara Star | 9123453 |\n| Volga Dawn | 9876505 |';
  const { row } = await checked({
    page,
    payload: NEW_VESSEL,
    span: { start: 2, end: Array.from(page).length - 2 },
  });
  expect(row).toMatchObject({ span_result: 'fail', counts: false });
});

test('a span in one table row passes', async () => {
  const page = '| Nayara Star | 9123453 |\n| Volga Dawn | 9876505 |';
  const { row } = await checked({
    page,
    payload: NEW_VESSEL,
    span: spanOf(page, '| Nayara Star | 9123453 |'),
  });
  expect(row).toMatchObject({ span_result: 'pass', counts: true });
});

// ------------------------------------------------------------------- the window ---

const WINDOW_CASES: readonly (readonly [string, string, string])[] = [
  ['a denial', 'The tanker Nayara Star left Sikka. The owner denies it.', 'denial'],
  ['a hedge in English', 'The tanker Nayara Star may be in Sikka now.', 'hedge'],
  ['a hedge in Russian', 'Танкер Nayara Star, возможно, находится в порту Sikka.', 'hedge'],
  ['a hedge in Ukrainian', 'Танкер Nayara Star, можливо, перебуває в порту Sikka.', 'hedge'],
  ['a future', 'The tanker Nayara Star will sail to Sikka next month.', 'future'],
  [
    'a conditional',
    'If the deal holds, the tanker Nayara Star would sail to Sikka.',
    'conditional',
  ],
  ['a question', 'Is the tanker Nayara Star in Sikka?', 'question'],
  ['an allegation', 'Activists allege that the tanker Nayara Star is in Sikka.', 'allegation'],
];

for (const [name, page, flag] of WINDOW_CASES)
  test(`a reading that asserts a span with ${name} in its window gives no plain "is"`, async () => {
    const { row, stored } = await checked({
      page,
      payload: { type: 'vessel', label: NAYARA, attrs: { last_port: 'Sikka' } },
      span: spanOf(page, page),
    });
    expect(stored[flag]).toBe(true);
    expect(row.held['modality']).toBe('modality_exceeds_window');
  });

test('a reading that alleges a span with an allegation word stays under the cap', async () => {
  const page = 'Activists allege that the tanker Nayara Star is in Sikka.';
  const { row } = await checked({
    page,
    payload: { type: 'vessel', label: NAYARA, attrs: { last_port: 'Sikka' } },
    span: spanOf(page, page),
    modality: 'alleges',
  });
  expect(row.held['modality']).toBeUndefined();
});

test('a span that mixes Arabic script with Latin text gives check_not_run', async () => {
  const page =
    'The tanker Nayara Star \u0641\u064A \u0627\u0644\u0645\u064A\u0646\u0627\u0621 Sikka.';
  const { row, stored } = await checked({
    page,
    payload: { type: 'vessel', label: NAYARA, attrs: { last_port: 'Sikka' } },
    span: spanOf(page, page),
  });
  expect(stored['window_run']).toBe(false);
  expect(row.held['modality']).toBe('check_not_run');
});

test('a span that matches a court-act cue sets court_act', async () => {
  const page = 'The court sentenced the master of the tanker Nayara Star in Sikka.';
  const { stored } = await checked({
    page,
    payload: { type: 'vessel', label: NAYARA, attrs: { last_port: 'Sikka' } },
    span: spanOf(page, page),
  });
  expect(stored['court_act']).toBe(true);
});

// ---------------------------------------------------------------------- the fields ---

test('a date written 04/05/2026 with no stored locale makes the field held', async () => {
  const page = 'The tanker Nayara Star left Sikka on 04/05/2026.';
  const { row } = await checked({
    page,
    payload: { type: 'vessel', label: NAYARA, attrs: { departed_on: '2026-05-04' } },
    span: spanOf(page, page),
  });
  expect(row.held['departed_on']).toBe('check_not_run');
});

test('a date with a month name needs no locale and matches', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: { type: 'vessel', label: NAYARA, attrs: { departed_on: '2026-05-03' } },
  });
  expect(row).toMatchObject({ support: 'value', counts: true, held: {} });
});

test('an identifier with one look-alike character of another script fails', async () => {
  const page = 'The tanker Nayara Star (IMO 91234\u04213) left Sikka.';
  const { row } = await checked({ page, payload: NEW_VESSEL, span: spanOf(page, page) });
  expect(row).toMatchObject({ support: 'name_only', counts: false });
});

test('an identifier with a full-width digit fails', async () => {
  const page = 'The tanker Nayara Star (IMO 912345\uFF13) left Sikka.';
  const { row } = await checked({ page, payload: NEW_VESSEL, span: spanOf(page, page) });
  expect(row.counts).toBe(false);
});

test('an identifier that differs in one digit never matches, at any name threshold', async () => {
  const page = 'The tanker Nayara Star (IMO 9123458) left Sikka.';
  const { row } = await checked(
    { page, payload: NEW_VESSEL, span: spanOf(page, page) },
    async (ask) => {
      await ask("INSERT INTO public.parameter (key, value) VALUES ('name_match.min_ratio', 0.5)");
    },
  );
  expect(row.counts).toBe(false);
});

const RATIO = `SELECT public.ev_name_found($1, $2) AS found`;
const found = z.array(z.object({ found: z.boolean() })).length(1);

const nameFound = (name: string, span: string, ratio: number | null): Promise<boolean> =>
  rolledBack('superuser', async (ask) => {
    if (ratio !== null)
      await ask("INSERT INTO public.parameter (key, value) VALUES ('name_match.min_ratio', $1)", [
        ratio,
      ]);
    const [row] = found.parse(await ask(RATIO, [name, span]));
    return row?.found ?? false;
  });

test('a name with a small spelling change matches above the threshold', async () => {
  // "nayara starr" against "nayara star": one edit in twelve code points, a ratio of 11/12.
  expect(await nameFound('Nayara Star', 'The tanker Nayara Starr left.', 0.9)).toBe(true);
});

test('a name at the edge of the threshold matches on one side and not on the other', async () => {
  expect(await nameFound('Nayara Star', 'The tanker Nayara Starr left.', 11 / 12)).toBe(true);
  expect(await nameFound('Nayara Star', 'The tanker Nayara Starr left.', 11 / 12 + 0.001)).toBe(
    false,
  );
});

test('with no threshold row, no fuzzy match passes, and an exact name still matches', async () => {
  expect(await nameFound('Nayara Star', 'The tanker Nayara Starr left.', null)).toBe(false);
  expect(await nameFound('Nayara Star', 'The tanker NAYARA  star left.', null)).toBe(true);
});

// ------------------------------------------------------------- the second reading ---

test('two readers that disagree on the modality make the modality held', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: NEW_VESSEL,
    second: { ...spanOf(PAGE, SENTENCE), modality: 'attributes' },
  });
  expect(row.held['modality']).toBe('reader_disagreement');
});

test('two readers that disagree on adverse make adverse held', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: NEW_VESSEL,
    second: { ...spanOf(PAGE, SENTENCE), adverse: true },
  });
  expect(row.held['adverse']).toBe('reader_disagreement');
});

test('two readers that disagree on a value make that field held', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: NEW_VESSEL,
    second: spanOf(PAGE, 'The tanker Nayara Star'),
  });
  expect(row.held['imo']).toBe('reader_disagreement');
  expect(row.held['label']).toBeUndefined();
});

test('a second reader is linked to the first by span overlap alone', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: NEW_VESSEL,
    second: spanOf(PAGE, 'Nayara Star (IMO 9123453) left Sikka'),
  });
  expect(row.held).toStrictEqual({});
});

for (const [name, seed] of [
  ['the second job failed', { secondJob: 'failed', second: 'none' }],
  ['no second job exists', { secondJob: 'absent' }],
  [
    'the served model is not the pinned model',
    { second: { ...spanOf(PAGE, SENTENCE), served: 'family-c/model-c' } },
  ],
  [
    'a call of the second job failed and no reading covers the span',
    { second: 'none', secondCallOutcome: 'network' },
  ],
] as const)
  test(`with no second reading the reason is no_second_reading: ${name}`, async () => {
    const { row } = await checked({ page: PAGE, payload: NEW_VESSEL, ...seed });
    expect(row.held['reading']).toBe('no_second_reading');
  });

test('a second reader that read the page and found nothing at the span disagrees', async () => {
  const { row } = await checked({ page: PAGE, payload: NEW_VESSEL, second: 'none' });
  expect(row.held['reading']).toBe('reader_disagreement');
});

test('two readers of one family give same_family true', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: NEW_VESSEL,
    second: { ...spanOf(PAGE, SENTENCE), family: 'family-a' },
  });
  expect(row.same_family).toBe('true');
});

test('a claim with no first reading on the document gets no check row and no citation', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: 'doc_evidence_bare', pages: [PAGE] });
    const extract = await aJob(ask, 'doc_evidence_bare', 'extract_text');
    const call = await aCall(ask, extract);
    const claim = await aClaim(ask, {
      documents: ['doc_evidence_bare'],
      call,
      payload: NEW_VESSEL,
    });
    await endJob(ask, extract, 'failed');
    const evidence = await aJob(ask, 'doc_evidence_bare', 'evidence_check');
    const rows = await runChecks(ask, evidence, claim);
    const counts = z.array(z.object({ checks: z.string(), citations: z.string() })).parse(
      await ask(
        `SELECT (SELECT count(*) FROM public.citation_check WHERE claim_id = $1)::text AS checks,
                  (SELECT count(*) FROM public.citation WHERE claim_id = $1)::text AS citations`,
        [claim],
      ),
    );
    return { rows, counts };
  });
  expect(seen).toStrictEqual({ rows: [], counts: [{ checks: '0', citations: '0' }] });
});

// -------------------------------------------------------------------- the image ---

const OCR_SET = 'tesseract:5.5.0:4.0.0';
const OCR_PAGE = 'NAYARA STAR\nIMO 9123453\nOwner: Sikka Shipping';

const imageSeed = (payload: Readonly<Record<string, unknown>>, op?: PairSeed['op']) =>
  ({
    page: OCR_PAGE,
    mime: 'image/png',
    textSet: OCR_SET,
    payload,
    ...(op === undefined ? {} : { op }),
    span: spanOf(OCR_PAGE, 'NAYARA STAR'),
  }) as const;

test('an image claim with an OCR row that holds the value passes, and the citation is marked ocr', async () => {
  const { row, stored } = await checked(
    { ...imageSeed({ type: 'vessel', label: NAYARA }), secondJob: 'absent' },
    async (ask, pair) => {
      await aReading(ask, {
        job: pair.evidence,
        claim: pair.claim,
        textSet: OCR_SET,
        ...spanOf(OCR_PAGE, 'NAYARA STAR'),
        modality: 'asserts',
      });
    },
  );
  expect(row).toMatchObject({ span_result: 'pass', counts: true, same_family: 'false' });
  expect(stored['ocr']).toBe(true);
});

test('a value that is not in the OCR text counts 0, and two model readings of one image count as one', async () => {
  const { row } = await checked(imageSeed({ type: 'vessel', label: NAYARA }));
  expect(row).toMatchObject({ span_result: 'not_in_ocr', counts: false });
});

test('a relation read from a chart image gives a name citation only', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: 'doc_evidence_ends', pages: ['ends'] });
    const army = await anEntity(ask, 'doc_evidence_ends', 'military_unit', 'NAYARA STAR');
    const front = await anEntity(ask, 'doc_evidence_ends', 'military_unit', 'Owner');
    const pair = await aPair(ask, {
      ...imageSeed(
        {
          type: 'subordinate_to',
          src_kind: 'entity',
          src_id: army,
          dst_kind: 'entity',
          dst_id: front,
        },
        'create_relation',
      ),
      secondJob: 'absent',
    });
    await aReading(ask, {
      job: pair.evidence,
      claim: pair.claim,
      textSet: OCR_SET,
      ...spanOf(OCR_PAGE, 'NAYARA STAR'),
    });
    return only(await runChecks(ask, pair.evidence, pair.claim));
  });
  expect(seen).toMatchObject({ support: 'name_only', counts: false });
});

// -------------------------------------------------------------------- the parser ---

const SDN_ROW = '36001,"NAYARA STAR","vessel","RUSSIA-EO14024",-0- ,"IMO 9123453"';

test('a parser row that agrees with the first reading passes', async () => {
  const { row } = await checked(
    {
      page: SDN_ROW,
      mime: 'text/csv',
      payload: NEW_VESSEL,
      span: spanOf(SDN_ROW, SDN_ROW),
      secondJob: 'absent',
    },
    async (ask, pair) => {
      await aReading(ask, {
        job: pair.evidence,
        claim: pair.claim,
        ...spanOf(SDN_ROW, SDN_ROW),
        modality: 'enacts',
        parsed: { name: 'NAYARA STAR', imo: '9123453' },
        actEffect: 'insert',
      });
    },
  );
  expect(row).toMatchObject({ counts: true, held: {}, same_family: 'false' });
});

test('a parser row that reads another IMO makes the field held, and no third reader runs', async () => {
  const { row } = await checked(
    {
      page: SDN_ROW,
      mime: 'text/csv',
      payload: NEW_VESSEL,
      span: spanOf(SDN_ROW, SDN_ROW),
      secondJob: 'absent',
    },
    async (ask, pair) => {
      await aReading(ask, {
        job: pair.evidence,
        claim: pair.claim,
        ...spanOf(SDN_ROW, SDN_ROW),
        modality: 'enacts',
        parsed: { name: 'NAYARA STAR', imo: '9876505' },
        actEffect: 'insert',
      });
    },
  );
  expect(row.held['imo']).toBe('reader_disagreement');
});

// ------------------------------------------------------------------ the absence ---

test('a reading whose value is an absence is held as absence_unproven', async () => {
  const page = 'No record of the tanker Nayara Star (IMO 9123453) was found in the register.';
  const { row } = await checked({ page, payload: NEW_VESSEL, span: spanOf(page, page) });
  expect(row.held['imo']).toBe('absence_unproven');
});

// ---------------------------------------------------------------- the identity ---

const vesselTarget = (
  attrs: Readonly<Record<string, unknown>>,
  window: { from: string; to: string } | null,
) => {
  let target = '';
  return {
    before: async (ask: Ask, document: string) => {
      target = await anEntity(ask, document, 'vessel', NAYARA, attrs);
      if (window !== null) {
        const state = await anEntity(ask, document, 'company', 'Flag registry');
        await aRelation(ask, document, {
          type: 'flags',
          src: state,
          dst: target,
          attrs: { mmsi: '273456789', name: NAYARA },
          validFrom: window.from,
          validTo: window.to,
        });
      }
    },
    target: () => target,
  };
};

const identityOf = async (
  page: string,
  attrs: Readonly<Record<string, unknown>>,
  window: { from: string; to: string } | null,
): Promise<CheckRow> => {
  const vessel = vesselTarget(attrs, window);
  return rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: 'doc_evidence_target', pages: ['seed'] });
    await vessel.before(ask, 'doc_evidence_target');
    const pair = await aPair(ask, {
      page,
      op: 'update_attrs',
      targetKind: 'entity',
      targetId: vessel.target(),
      payload: { attrs: { last_port: 'Sikka' } },
      span: spanOf(page, page),
    });
    return only(await runChecks(ask, pair.evidence, pair.claim));
  });
};

const WINDOW = { from: '2026-01-01', to: '2026-12-31' };
const VESSEL_PAGE = 'The tanker Nayara Star (IMO 9123453) left Sikka on 3 May 2026.';

test('a vessel with a valid IMO in the page and a window that holds the document date passes', async () => {
  expect(await identityOf(VESSEL_PAGE, { imo: '9123453' }, WINDOW)).toMatchObject({
    identity: 'pass',
    counts: true,
  });
});

test('a vessel matched by name only fails the identity check, and the citation counts 0', async () => {
  const page = 'The tanker Nayara Star left Sikka on 3 May 2026.';
  expect(await identityOf(page, { imo: '9123453' }, WINDOW)).toMatchObject({
    identity: 'lead',
    counts: false,
  });
});

test('a valid IMO with a document date outside the MMSI, name and flag window fails', async () => {
  expect(
    await identityOf(VESSEL_PAGE, { imo: '9123453' }, { from: '2024-01-01', to: '2024-12-31' }),
  ).toMatchObject({ identity: 'fail', counts: false });
});

test('an IMO with a wrong checksum fails', async () => {
  const page = 'The tanker Nayara Star (IMO 9123454) left Sikka on 3 May 2026.';
  expect(await identityOf(page, { imo: '9123454' }, WINDOW)).toMatchObject({
    identity: 'fail',
    counts: false,
  });
});

test('an IMO that a source with no issuer card marks cloned gives identity_pending', async () => {
  const row = await identityOf(VESSEL_PAGE, { imo: '9123453', imo_mark: 'cloned' }, WINDOW);
  expect(row.identity).toBe('pending');
  expect(row.held['identity']).toBe('identity_pending');
});

test('a record that is not stored yet gives identity_pending', async () => {
  const row = await identityOf(VESSEL_PAGE, {}, null);
  expect(row.identity).toBe('pending');
  expect(row.held['identity']).toBe('identity_pending');
});

const partyIdentity = async (
  type: string,
  label: string,
  attrs: Readonly<Record<string, unknown>>,
  page: string,
  extra?: (ask: Ask, document: string, target: string) => Promise<void>,
): Promise<CheckRow> =>
  rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: 'doc_evidence_party', pages: ['seed'] });
    const target = await anEntity(ask, 'doc_evidence_party', type, label, attrs);
    if (extra !== undefined) await extra(ask, 'doc_evidence_party', target);
    const pair = await aPair(ask, {
      page,
      op: 'update_attrs',
      targetKind: 'entity',
      targetId: target,
      payload: { attrs: { seat: 'Sikka' } },
      span: spanOf(page, page),
    });
    return only(await runChecks(ask, pair.evidence, pair.claim));
  });

test('a company with a valid OGRN of 13 digits in the page passes', async () => {
  const row = await partyIdentity(
    'company',
    'Sikka Shipping',
    { ogrn: '1027700012340' },
    'Sikka Shipping (OGRN 1027700012340) has its seat in Sikka.',
  );
  expect(row.identity).toBe('pass');
});

test('a company with a valid OGRN of 15 digits in the page passes', async () => {
  const row = await partyIdentity(
    'company',
    'Sikka Shipping',
    { ogrn: '312774600123451' },
    'Sikka Shipping (OGRN 312774600123451) has its seat in Sikka.',
  );
  expect(row.identity).toBe('pass');
});

test('a company with a valid LEI in the page passes, and a wrong LEI checksum fails', async () => {
  const pass = await partyIdentity(
    'company',
    'Sikka Shipping',
    { lei: '5299000GABTEST000120' },
    'Sikka Shipping (LEI 5299000GABTEST000120) has its seat in Sikka.',
  );
  const fail = await partyIdentity(
    'company',
    'Sikka Shipping',
    { lei: '5299000GABTEST000121' },
    'Sikka Shipping (LEI 5299000GABTEST000121) has its seat in Sikka.',
  );
  expect([pass.identity, fail.identity]).toStrictEqual(['pass', 'fail']);
});

test('a person with two identifiers in the page passes', async () => {
  const row = await partyIdentity(
    'person',
    'Ivan Petrov',
    { date_of_birth: '1970-02-03', tax_id: '770708389301' },
    'Ivan Petrov, born 3 February 1970, tax id 770708389301, lives in Sikka.',
  );
  expect(row.identity).toBe('pass');
});

test('a person with one strong identifier in the page passes', async () => {
  const row = await partyIdentity(
    'person',
    'Ivan Petrov',
    { passport_number: 'AB1234567' },
    'Ivan Petrov, passport AB1234567, lives in Sikka.',
  );
  expect(row.identity).toBe('pass');
});

test('a person with one weak identifier in the page is a lead', async () => {
  const row = await partyIdentity(
    'person',
    'Ivan Petrov',
    { date_of_birth: '1970-02-03', tax_id: '770708389301' },
    'Ivan Petrov, born 3 February 1970, lives in Sikka.',
  );
  expect(row).toMatchObject({ identity: 'lead', counts: false });
});

test('a military unit with its number, designation and parent in the page passes', async () => {
  const row = await partyIdentity(
    'military_unit',
    '47th Tank Division',
    { vch_number: '45807' },
    'The 47th Tank Division (military unit 45807) of the 1st Tank Army is based in Sikka.',
    async (ask, document, target) => {
      const parent = await anEntity(ask, document, 'military_unit', '1st Tank Army');
      await aRelation(ask, document, { type: 'subordinate_to', src: target, dst: parent });
    },
  );
  expect(row.identity).toBe('pass');
});

test('two military unit numbers for one unit give vch_conflict, not a match', async () => {
  const row = await partyIdentity(
    'military_unit',
    '47th Tank Division',
    { vch_number: ['45807', '54096'] },
    'The 47th Tank Division (military unit 45807) of the 1st Tank Army is based in Sikka.',
    async (ask, document, target) => {
      const parent = await anEntity(ask, document, 'military_unit', '1st Tank Army');
      await aRelation(ask, document, { type: 'subordinate_to', src: target, dst: parent });
    },
  );
  expect(row.held['identity']).toBe('vch_conflict');
  expect(row.identity).not.toBe('pass');
});

// ------------------------------------------------------------------- the checksums ---

const CHECKSUM = z.array(z.object({ ok: z.boolean() })).length(1);

const helper = (name: string, value: string): Promise<boolean> =>
  rolledBack('superuser', async (ask) => {
    const [row] = CHECKSUM.parse(await ask(`SELECT public.${name}($1) AS ok`, [value]));
    return row?.ok ?? false;
  });

test('the OGRN helper takes 13 and 15 digits with their check digit and refuses a wrong one', async () => {
  expect(
    await Promise.all(
      [
        '1027700012340',
        '5123456789011',
        '312774600123451',
        '1027700012341',
        '312774600123452',
        '10277000123',
      ].map((value) => helper('ev_ogrn_valid', value)),
    ),
  ).toStrictEqual([true, true, true, false, false, false]);
});

test('the LEI helper follows ISO 7064 mod 97-10', async () => {
  expect(
    await Promise.all(
      [
        '5299000GABTEST000120',
        '9845000GABFIXTURE165',
        '5299000GABTEST000121',
        '5299000gabtest000120',
      ].map((value) => helper('ev_lei_valid', value)),
    ),
  ).toStrictEqual([true, true, false, false]);
});

test('MMSI and CIN take a format check only', async () => {
  expect(
    await Promise.all([
      helper('ev_mmsi_format', '273456789'),
      helper('ev_mmsi_format', '27345678'),
      helper('ev_cin_format', 'U12345MH2001PTC123456'),
      helper('ev_cin_format', 'X12345MH2001PTC123456'),
    ]),
  ).toStrictEqual([true, false, true, false]);
});

// ------------------------------------------------------------------ the unreadable ---

// A claim whose only document is a dead link has no job and so no check row, which fails closed.
// This claim also cites a stored document, so its job runs and its check row names the dead link.
test('a claim with a stored document and a second document that is a dead link gets unreadable for the dead link', async () => {
  const { row } = await checked({
    page: PAGE,
    payload: NEW_VESSEL,
    extraDocuments: ['doc_evidence_dead'],
    before: async (ask) => {
      await ask(
        `SELECT public.put_document('doc_evidence_dead', 'url', 'A link that gave no page', NULL,
           'https://example.org/gone')`,
      );
    },
  });
  expect(row.held['document:doc_evidence_dead']).toBe('unreadable');
});

test('a captcha page and a channel link with no post id each give unreadable', async () => {
  const captcha = 'Please complete the captcha. The tanker Nayara Star (IMO 9123453) left Sikka.';
  const one = await checked({
    page: captcha,
    payload: NEW_VESSEL,
    span: spanOf(captcha, 'The tanker Nayara Star (IMO 9123453) left Sikka.'),
  });
  const two = await checked({ page: PAGE, payload: NEW_VESSEL, uri: 'https://t.me/somechannel' });
  const three = await checked({
    page: PAGE,
    payload: NEW_VESSEL,
    uri: 'https://t.me/somechannel/1234',
  });
  expect([
    one.row.held['document:doc_evidence_pair'],
    two.row.held['document:doc_evidence_pair'],
    three.row.held['document:doc_evidence_pair'],
  ]).toStrictEqual(['unreadable', 'unreadable', undefined]);
});

// ------------------------------------------------------------- the current row ---

test('a second call with the same key adds no row and returns the first row', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const pair = await aPair(ask, {
      page: PAGE,
      payload: NEW_VESSEL,
      span: spanOf(PAGE, SENTENCE),
    });
    const first = only(await runChecks(ask, pair.evidence, pair.claim));
    const second = only(await runChecks(ask, pair.evidence, pair.claim));
    const [count] = z
      .array(z.object({ n: z.string() }))
      .parse(
        await ask('SELECT count(*)::text AS n FROM public.citation_check WHERE claim_id = $1', [
          pair.claim,
        ]),
      );
    return { same: first.check_id === second.check_id, n: count?.n };
  });
  expect(seen).toStrictEqual({ same: true, n: '1' });
});

test('a call with a new key adds a row, and the older row is no longer current', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const pair = await aPair(ask, {
      page: PAGE,
      payload: { type: 'vessel', label: 'Nayara Starr' },
      span: spanOf(PAGE, SENTENCE),
    });
    const first = only(await runChecks(ask, pair.evidence, pair.claim));
    await ask("INSERT INTO public.parameter (key, value) VALUES ('name_match.min_ratio', 0.9)");
    const second = only(await runChecks(ask, pair.evidence, pair.claim));
    const current = z
      .array(z.object({ id: z.uuid() }))
      .parse(
        await ask('SELECT id FROM public.citation_check_current WHERE claim_id = $1', [pair.claim]),
      );
    return { first, second, current: current.map((row) => row.id) };
  });
  expect(seen.first.counts).toBe(false);
  expect(seen.second.counts).toBe(true);
  expect(seen.second.check_id).not.toBe(seen.first.check_id);
  expect(seen.current).toStrictEqual([seen.second.check_id]);
});

// ----------------------------------------------------------- the family probe ---

const PROBE = `SELECT public.record_family_probe(p_prompt_set_version => 'probe-set@1',
  p_model_a => 'family-a/model-a', p_model_b => 'family-b/model-b', p_prompts => 10,
  p_matches => $1::int) AS passed`;
const passedShape = z.array(z.object({ passed: z.boolean() })).length(1);

const probeOf = (matches: number, threshold: number | null): Promise<boolean> =>
  rolledBack('superuser', async (ask) => {
    if (threshold !== null)
      await ask(
        "INSERT INTO public.parameter (key, value) VALUES ('family_probe.match_threshold', $1)",
        [threshold],
      );
    return asRole(ask, 'gabriel_app', async () => {
      const [row] = passedShape.parse(await ask(PROBE, [matches]));
      return row?.passed ?? true;
    });
  });

test('with no family_probe.match_threshold row, the probe does not pass', async () => {
  expect(await probeOf(0, null)).toBe(false);
});

test('answers that match above the threshold fail the probe, and answers below it pass', async () => {
  expect([await probeOf(9, 0.5), await probeOf(2, 0.5)]).toStrictEqual([false, true]);
});

const currentFamily = async (probes: readonly (readonly [string, boolean])[]): Promise<string> =>
  rolledBack('superuser', async (ask) => {
    const pair = await aPair(ask, {
      page: PAGE,
      payload: NEW_VESSEL,
      span: spanOf(PAGE, SENTENCE),
    });
    for (const [at, passed] of probes)
      await ask(
        `INSERT INTO public.family_probe_run (prompt_set_version, model_a, model_b, prompts,
           matches, threshold, passed, run_at)
         VALUES ('probe-set@1', 'a', 'b', 10, 1, 0.5, $1, $2::timestamptz)`,
        [passed, at],
      );
    const row = only(await runChecks(ask, pair.evidence, pair.claim));
    const [current] = z
      .array(z.object({ same_family: z.string() }))
      .parse(
        await ask('SELECT same_family FROM public.citation_check_current WHERE id = $1', [
          row.check_id,
        ]),
      );
    return current?.same_family ?? 'absent';
  });

test('with no passed probe, every free-text reading is unknown', async () => {
  expect(await currentFamily([])).toBe('unknown');
});

test('after a passed probe and no failure, the stored value stands', async () => {
  expect(await currentFamily([['2000-01-01', true]])).toBe('false');
});

test('a failed probe sets unknown on the free-text readings since the last passed probe', async () => {
  expect(
    await currentFamily([
      ['2000-01-01', true],
      ['2100-01-01', false],
    ]),
  ).toBe('unknown');
});

// -------------------------------------------------------------- the write-once citation ---

test('a write-once column of a citation changes from NULL to a value once, and a second change is refused', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const pair = await aPair(ask, {
      page: PAGE,
      payload: NEW_VESSEL,
      span: spanOf(PAGE, SENTENCE),
    });
    const row = only(await runChecks(ask, pair.evidence, pair.claim));
    await ask('ALTER TABLE public.citation ADD COLUMN probe_mark text');
    await ask("UPDATE public.citation SET probe_mark = 'first' WHERE id = $1", [row.citation_id]);
    try {
      await ask("UPDATE public.citation SET probe_mark = 'second' WHERE id = $1", [
        row.citation_id,
      ]);
      return 'changed twice';
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'refused';
    }
  });
  expect(outcome).toMatch(/write-once/u);
});

test('a fixed column of a citation never changes', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const pair = await aPair(ask, {
        page: PAGE,
        payload: NEW_VESSEL,
        span: spanOf(PAGE, SENTENCE),
      });
      const row = only(await runChecks(ask, pair.evidence, pair.claim));
      return ask("UPDATE public.citation SET modality = 'denies' WHERE id = $1", [row.citation_id]);
    }),
  ).rejects.toThrow(/fixed/u);
});

// ------------------------------------------------------------- the guard of the door ---

test('the door refuses a job that is not an evidence_check job', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const pair = await aPair(ask, {
        page: PAGE,
        payload: NEW_VESSEL,
        span: spanOf(PAGE, SENTENCE),
      });
      const other = await aJob(ask, pair.document, 'extract_text');
      return runChecks(ask, other, pair.claim);
    }),
  ).rejects.toMatchObject({ code: '22023' });
});

test('the door refuses a claim that does not cite the document of the job', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const pair = await aPair(ask, {
        page: PAGE,
        payload: NEW_VESSEL,
        span: spanOf(PAGE, SENTENCE),
      });
      await aDocument(ask, { id: 'doc_evidence_other', pages: [PAGE] });
      const other = await aJob(ask, 'doc_evidence_other', 'evidence_check');
      return runChecks(ask, other, pair.claim);
    }),
  ).rejects.toMatchObject({ code: '22023' });
});

test('the door takes no result argument', async () => {
  const rows = await rolledBack('superuser', (ask) =>
    ask(
      `SELECT pg_get_function_identity_arguments(p.oid) AS args
         FROM pg_proc p WHERE p.proname = 'run_evidence_checks'`,
    ),
  );
  expect(rows).toStrictEqual([{ args: 'p_job uuid, p_claim uuid' }]);
});

test('the door writes a citation from the first reading, with its text set', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const pair = await aPair(ask, {
      page: PAGE,
      payload: NEW_VESSEL,
      span: spanOf(PAGE, SENTENCE),
    });
    const row = only(await runChecks(ask, pair.evidence, pair.claim));
    return ask(
      `SELECT text_extractor, page, start, "end", modality FROM public.citation WHERE id = $1`,
      [row.citation_id],
    );
  });
  expect(seen).toStrictEqual([
    { text_extractor: 'evidence-test@1', page: 1, ...spanOf(PAGE, SENTENCE), modality: 'asserts' },
  ]);
});

test('the check row names the readings that it compared', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const pair = await aPair(ask, {
      page: PAGE,
      payload: NEW_VESSEL,
      span: spanOf(PAGE, SENTENCE),
    });
    const row = only(await runChecks(ask, pair.evidence, pair.claim));
    const stored = await storedCheck(ask, row.check_id);
    return { ids: stored['reading_ids'], first: pair.first, second: pair.second };
  });
  expect(seen.ids).toStrictEqual([seen.first, seen.second].sort());
});
