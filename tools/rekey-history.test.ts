import { describe, expect, it } from 'vitest';

import {
  planAllHistory,
  planBare,
  planHistory,
  type Carrier,
  type Fix,
  type Recorded,
} from './rekey-history.ts';

const VESSEL = '11111111-1111-4111-8111-111111111111';

// The shape of a page: a main block, and then the block of the false data of the vessel.
const PAGE = [
  'Vessel NS Leader',
  'IMO: 9441489',
  'MMSI: 273456789',
  'Call sign: UBXP',
  'Build year: 2008',
  'False data used by the vessel',
  'Flag: Panama',
  'MMSI: 351000001',
  'Call sign: HOAX',
].join('\n');

const act = (attrs: Record<string, unknown>, change: Partial<Carrier> = {}): Carrier => ({
  id: 'a1',
  status: 'pending',
  op: 'update_attrs',
  payload: {
    attrs: Object.fromEntries(Object.entries(attrs).map(([key, v]) => [key, { v }])),
  },
  targetId: VESSEL,
  names: [],
  originator: 'x',
  dissent: false,
  cites: [
    {
      document: 'doc_page',
      page: 1,
      excerpt: 'MMSI: 273456789',
      modality: 'asserts',
      pageText: PAGE,
    },
  ],
  ...change,
});

const record = (attrs: Recorded['attrs'] = {}): Recorded => ({
  id: VESSEL,
  type: 'vessel',
  attrs: { imo: { v: '9441489', src: ['doc_old'] }, ...attrs },
});

const OLD_PAGES = new Map([
  ['doc_old', [{ document: 'doc_old', page: 1, text: 'Vessel\nMMSI 215000111\nFlag Malta' }]],
]);

const sent = (plan: ReturnType<typeof planHistory>): Fix => {
  if (plan.kind !== 'send') throw new Error(`held: ${plan.reason}`);
  return plan.value;
};

describe('planHistory', () => {
  it('adds the MMSI of the page to the list of the record and keeps a passage of each old one', () => {
    const fix = sent(
      planHistory(
        act({ mmsi_history: '273456789', build_year: 2008 }),
        record({ mmsi_history: { v: ['215000111'], src: ['doc_old'] } }),
        OLD_PAGES,
      ),
    );
    expect(fix.attrs['mmsi_history']).toEqual({ v: ['215000111', '273456789'] });
    expect(fix.attrs['build_year']).toEqual({ v: 2008 });
    expect(fix.more.map((one) => one.document)).toEqual(
      expect.arrayContaining(['doc_page', 'doc_old']),
    );
    expect(fix.more.map((one) => one.excerpt)).toContain('MMSI: 273456789');
  });

  it('reads a list that the record holds as a text of JSON', () => {
    const fix = sent(
      planHistory(
        act({ mmsi_history: ['273456789'] }),
        record({ mmsi_history: { v: '["215000111"]', src: ['doc_old'] } }),
        OLD_PAGES,
      ),
    );
    expect(fix.attrs['mmsi_history']).toEqual({ v: ['215000111', '273456789'] });
  });

  it('leaves out a call sign that differs from the record, and keeps one that is the same', () => {
    const differs = sent(
      planHistory(
        act({ call_sign: 'UBXP', build_year: 2008 }),
        record({ call_sign: { v: 'ABCD' } }),
        OLD_PAGES,
      ),
    );
    expect(differs.left).toEqual(['call_sign']);
    expect(Object.keys(differs.attrs)).toEqual(['build_year']);
    const same = sent(
      planHistory(
        act({ call_sign: 'ubxp', build_year: 2008 }),
        record({ call_sign: { v: 'UBXP' } }),
        OLD_PAGES,
      ),
    );
    expect(Object.keys(same.attrs)).toContain('call_sign');
  });

  it('holds an act that only changes the call sign, and an act that adds no MMSI', () => {
    expect(
      planHistory(act({ call_sign: 'UBXP' }), record({ call_sign: { v: 'ABCD' } }), OLD_PAGES),
    ).toEqual({ kind: 'hold', reason: 'only the call sign differs' });
    expect(
      planHistory(
        act({ mmsi_history: '273456789' }),
        record({ mmsi_history: { v: ['273456789'], src: ['doc_old'] } }),
        OLD_PAGES,
      ),
    ).toEqual({ kind: 'hold', reason: 'the act changes nothing' });
  });

  it('holds an MMSI of the block of false data, and one that the page does not state', () => {
    expect(planHistory(act({ mmsi_history: '351000001' }), record(), OLD_PAGES)).toEqual({
      kind: 'hold',
      reason: 'the MMSI stands in the block of false data',
    });
    expect(planHistory(act({ mmsi_history: '273999999' }), record(), OLD_PAGES)).toEqual({
      kind: 'hold',
      reason: 'the MMSI is not on the page under its label',
    });
    expect(planHistory(act({ mmsi_history: 'unknown' }), record(), OLD_PAGES)).toEqual({
      kind: 'hold',
      reason: 'the MMSI is no number of nine digits',
    });
  });

  it('holds when the IMO of the page is not the IMO of the record', () => {
    const other = { ...record(), attrs: { imo: { v: '9074729' } } };
    expect(planHistory(act({ mmsi_history: '273456789' }), other, OLD_PAGES)).toEqual({
      kind: 'hold',
      reason: 'the IMO of the page differs from the IMO of the record',
    });
    const nothing = { ...record(), attrs: {} };
    expect(planHistory(act({ mmsi_history: '273456789' }), nothing, OLD_PAGES)).toEqual({
      kind: 'hold',
      reason: 'the vessel of the record has no IMO',
    });
    const bare = act({ mmsi_history: '273456789' }, { cites: [] });
    expect(planHistory(bare, record(), OLD_PAGES)).toEqual({
      kind: 'hold',
      reason: 'the page names no IMO under its label',
    });
  });

  it('holds when an MMSI of the record is in no passage of its sources', () => {
    expect(
      planHistory(
        act({ mmsi_history: '273456789' }),
        record({ mmsi_history: { v: ['215999999'], src: ['doc_old'] } }),
        OLD_PAGES,
      ),
    ).toEqual({ kind: 'hold', reason: 'an MMSI of the record is in no passage of its sources' });
  });

  it('holds a target that is no vessel of the record, and a drifted key', () => {
    expect(planHistory(act({ mmsi_history: '273456789' }), undefined, OLD_PAGES)).toEqual({
      kind: 'hold',
      reason: 'the target is not an entity of the record',
    });
    expect(
      planHistory(act({ mmsi_history: '273456789', dwt_t: 9000 }), record(), OLD_PAGES),
    ).toEqual({ kind: 'hold', reason: 'the act holds a drifted key: re-key it first' });
  });

  it('holds two pending acts that change the same key of one entity', () => {
    const found = planAllHistory(
      [act({ mmsi_history: '273456789' }), act({ mmsi_history: '273456789' }, { id: 'a2' })],
      new Map([[VESSEL, record()]]),
      OLD_PAGES,
    );
    expect(found.map((one) => one.plan.kind)).toEqual(['hold', 'hold']);
  });
});

describe('planBare', () => {
  const COMPANY = '22222222-2222-4222-8222-222222222222';
  const text = 'Owner\nIMO company number: 1234567\nAddress: Moscow';
  const carrier = (attrs: Record<string, unknown>, status = 'rejected'): Carrier =>
    act(attrs, {
      id: 'c1',
      status,
      targetId: COMPANY,
      cites: [
        {
          document: 'doc_page',
          page: 1,
          excerpt: 'Address: Moscow',
          modality: 'asserts',
          pageText: text,
        },
      ],
    });
  const bare = (type: string): Recorded => ({ id: COMPANY, type, attrs: {} });

  it('adds the number of a company from the page, with the passage that states it', () => {
    const plan = planBare(bare('company'), [carrier({ imo_company_number: '1234567' })], new Map());
    if (plan.kind !== 'send') throw new Error(plan.reason);
    expect(plan.value.attrs).toEqual({ imo_company_number: { v: '1234567' } });
    expect(plan.value.more[0]?.excerpt).toBe('IMO company number: 1234567');
    expect(plan.value.olds).toEqual([]);
  });

  it('keeps another value of the act only when a passage states it, and rejects a pending act', () => {
    const plan = planBare(
      bare('company'),
      [carrier({ imo_company_number: '1234567', address: 'Moscow', city: 'Omsk' }, 'pending')],
      new Map(),
    );
    if (plan.kind !== 'send') throw new Error(plan.reason);
    expect(Object.keys(plan.value.attrs)).toEqual(['imo_company_number', 'address']);
    expect(plan.value.left).toEqual(['city']);
    expect(plan.value.olds).toHaveLength(1);
  });

  it('holds a number that the page does not state under an IMO label', () => {
    const plan = planBare(bare('company'), [carrier({ imo_company_number: '7654321' })], new Map());
    expect(plan).toEqual({ kind: 'hold', reason: 'no page states the number under an IMO label' });
  });

  it('holds a wrong check digit of a vessel and a number that another entity holds', () => {
    const vessel = { ...bare('vessel'), id: COMPANY };
    const page = 'IMO: 9441489';
    const given = (value: string): Carrier => ({
      ...carrier({ imo: value }),
      cites: [
        { document: 'doc_page', page: 1, excerpt: null, modality: 'asserts', pageText: page },
      ],
    });
    expect(planBare(vessel, [given('9441488')], new Map())).toEqual({
      kind: 'hold',
      reason: 'the check digit of the IMO is wrong',
    });
    expect(planBare(vessel, [given('9441489')], new Map([['9441489', ['other']]]))).toEqual({
      kind: 'hold',
      reason: 'another entity of the record holds this number',
    });
    expect(planBare(vessel, [given('9441489')], new Map()).kind).toBe('send');
  });
});
