import { describe, expect, it } from 'vitest';

import {
  classify,
  requalify,
  type Candidate,
  type Decision,
  type Sent,
} from './retype-relations.ts';

const make = (excerpt: string, over: Partial<Candidate> = {}): Candidate => ({
  relationId: crypto.randomUUID(),
  type: 'designated_by',
  subjectType: 'company',
  waiting: 'none',
  originator: 'The issuer',
  document: 'doc-1',
  page: 1,
  excerpt,
  pageText: `Header. ${excerpt} Footer.`,
  ...over,
});

const kindOf = (decision: Decision): string => decision.kind + ':' + (decision.batch ?? '');

describe('classify', () => {
  it('retypes an OFAC directive under EO 14024', () => {
    expect(kindOf(classify(make('Directive 4 under Executive Order 14024')))).toBe('retype:us');
  });

  it('retypes an OFAC directive under EO 13662', () => {
    expect(kindOf(classify(make('Directive 1 under E.O. 13662')))).toBe('retype:us');
  });

  it.each(['III', 'XIV', 'XLIV', 'XLV'])('retypes a company of Annex %s of 833/2014', (annex) => {
    expect(kindOf(classify(make(`listed in Annex ${annex} to Regulation 833/2014`)))).toBe(
      'retype:eu',
    );
  });

  it('retypes Article 5af of 833/2014', () => {
    expect(kindOf(classify(make('Article 5af of Regulation 833/2014')))).toBe('retype:eu');
  });

  it('puts a port of Annex XLVII in the batch of ports', () => {
    const port = make('Annex XLVII of Regulation 833/2014', { subjectType: 'port' });
    expect(kindOf(classify(port))).toBe('retype:ports');
  });

  it('keeps a vessel of Annex XLII', () => {
    const vessel = make('vessel listed in Annex XLII of 833/2014', { subjectType: 'vessel' });
    expect(classify(vessel).kind).toBe('keep');
  });

  it('keeps a listing with an asset freeze', () => {
    expect(classify(make('SDN entry, blocked property')).kind).toBe('keep');
    expect(classify(make('Annex I of Regulation 269/2014')).kind).toBe('keep');
  });

  it('doubts an excerpt with no provision', () => {
    const decision = classify(make('The company is sanctioned.'));
    expect(decision.kind).toBe('doubtful');
    expect(decision.reason).toMatch(/no provision/);
  });

  it('doubts a provision outside both lists', () => {
    const decision = classify(make('Annex XX of Regulation 833/2014'));
    expect(decision.kind).toBe('doubtful');
    expect(decision.reason).toMatch(/unknown provision/);
  });

  it('doubts a text that no longer holds the excerpt', () => {
    const lost = make('Annex XLV of 833/2014', { pageText: 'Other words.' });
    expect(classify(lost).reason).toMatch(/no longer holds/);
    expect(classify(make('Annex XLV', { pageText: null })).kind).toBe('doubtful');
  });

  it('doubts a relation that has a waiting act', () => {
    const waiting = make('Annex XLV of 833/2014', { waiting: 'other' });
    expect(classify(waiting).reason).toMatch(/waiting act/);
  });

  it('doubts a person with no provision', () => {
    const person = make('He supports the war.', { subjectType: 'person' });
    expect(classify(person).reason).toMatch(/person/);
  });

  it('doubts a vessel under a sectoral annex', () => {
    const vessel = make('Annex XLV of 833/2014', { subjectType: 'vessel' });
    expect(classify(vessel).kind).toBe('doubtful');
  });
});

describe('requalify', () => {
  const us = make('Directive 4 under Executive Order 14024');
  const eu = make('Annex XLV of 833/2014');
  const port = make('Annex XLVII of 833/2014', { subjectType: 'port' });
  const vessel = make('Annex XLII of 833/2014', { subjectType: 'vessel' });
  const doubt = make('No words here.');
  const all = [port, eu, vessel, doubt, us];

  it('sends nothing in a dry run, and reports the three batches', async () => {
    const sent: Sent[] = [];
    const report = await requalify(all, { write: false, send: (batch) => void sent.push(batch) });
    expect(sent).toEqual([]);
    expect(report.batches.map((batch) => batch.name)).toEqual(['us', 'eu', 'ports']);
    expect(report.keep).toHaveLength(1);
    expect(report.doubtful.map((one) => one.relationId)).toEqual([doubt.relationId]);
  });

  it('sends US, then EU, then the ports, each as retype acts', async () => {
    const sent: Sent[] = [];
    await requalify(all, { write: true, send: (batch) => void sent.push(batch) });
    expect(sent.map((batch) => batch.name)).toEqual(['us', 'eu', 'ports']);
    expect(sent[0]?.items[0]?.act).toEqual({
      op: 'update_relation',
      targetId: us.relationId,
      type: 'restricted_by',
    });
  });

  it('skips a relation already retyped or with a waiting retype act', async () => {
    const done = make('Annex XLV of 833/2014', { type: 'restricted_by' });
    const queued = make('Annex XLV of 833/2014', { waiting: 'retype' });
    const sent: Sent[] = [];
    const report = await requalify([done, queued, us], {
      write: true,
      send: (batch) => void sent.push(batch),
    });
    expect(report.skipped).toHaveLength(2);
    expect(sent.map((batch) => batch.name)).toEqual(['us']);
  });

  it('cuts a batch into groups the propose tool accepts', async () => {
    const many = Array.from({ length: 51 }, () => make('Annex XLV of 833/2014'));
    const sent: Sent[] = [];
    await requalify(many, { write: true, send: (batch) => void sent.push(batch) });
    expect(sent.map((batch) => batch.items.length)).toEqual([50, 1]);
  });
});
