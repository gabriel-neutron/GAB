import { describe, expect, it } from 'vitest';

import { csvFields, entryForClaim, parseAnnexEntries, parseOjAct, parseSdnRow } from './parsers.ts';

// Each fixture is one invented entry or act. No list is loaded, and no value is real.
const SDN_ROW =
  '36001,"NAYARA STAR","vessel","RUSSIA-EO14024","-0-","UBCD7","Crude Oil Tanker","-0-","-0-",' +
  '"Russia","-0-","Vessel Registration Identification IMO 9123453; MMSI 273456789."';

const OJ_ACT = `<?xml version="1.0" encoding="UTF-8"?>
<ACT><TITLE><P>Council Implementing Regulation (EU) 2026/9999 amending Regulation (EU) No 833/2014</P></TITLE>
<ARTICLE><P>Annex XLII is amended as follows:</P>
<P>(1) the following entry is deleted:</P><P>VOLGA DAWN (IMO 9876505)</P>
<P>(2) the following entries are added:</P><P>NAYARA STAR (IMO 9123453)</P><P>SIKKA SPIRIT (IMO 9135793)</P>
</ARTICLE></ACT>`;

const ANNEX = `ANNEX XLII
List of vessels referred to in Article 3s
1. VOLGA DAWN, IMO 9876505
2. NAYARA STAR, IMO 9123453`;

const codePointSlice = (text: string, start: number, end: number): string =>
  Array.from(text).slice(start, end).join('');

describe('the SDN.CSV parser', () => {
  it('reads the fields of one row, with the IMO and the MMSI of its remarks', () => {
    const entry = parseSdnRow(SDN_ROW);
    expect(entry).toMatchObject({
      format: 'sdn_csv',
      effect: 'insert',
      fields: {
        ent_num: '36001',
        name: 'NAYARA STAR',
        sdn_type: 'vessel',
        program: 'RUSSIA-EO14024',
        call_sign: 'UBCD7',
        vessel_flag: 'Russia',
        imo: '9123453',
        mmsi: '273456789',
      },
    });
    expect(entry?.fields).not.toHaveProperty('title');
    expect(entry && codePointSlice(SDN_ROW, entry.start, entry.end)).toBe(SDN_ROW);
  });

  it('refuses a page of more than one row, so no list is read', () => {
    expect(parseSdnRow(`${SDN_ROW}\n${SDN_ROW}`)).toBeNull();
  });

  it('reads a quoted field with a comma and a doubled quote', () => {
    expect(csvFields('1,"A, ""B""",C')).toStrictEqual(['1', 'A, "B"', 'C']);
  });
});

describe('the EU OJ XML parser', () => {
  it('gives delete for the entry that the act deletes, and insert for the entries it adds', () => {
    const entries = parseOjAct(OJ_ACT);
    expect(entries.map((entry) => [entry.fields['name'], entry.effect])).toStrictEqual([
      ['VOLGA DAWN', 'delete'],
      ['NAYARA STAR', 'insert'],
      ['SIKKA SPIRIT', 'insert'],
    ]);
  });

  it('gives delete for an entry that one act inserts and deletes', () => {
    const act = OJ_ACT.replace('VOLGA DAWN (IMO 9876505)', 'NAYARA STAR (IMO 9123453)');
    const nayara = parseOjAct(act).filter((entry) => entry.fields['name'] === 'NAYARA STAR');
    expect(nayara.map((entry) => entry.effect)).toStrictEqual(['delete']);
  });

  it('gives the span of each entry in the stored page', () => {
    const [deleted] = parseOjAct(OJ_ACT);
    expect(deleted && codePointSlice(OJ_ACT, deleted.start, deleted.end)).toBe(
      'VOLGA DAWN (IMO 9876505)',
    );
  });
});

describe('the annex XLII parser', () => {
  it('reads each numbered entry of the annex', () => {
    expect(parseAnnexEntries(ANNEX).map((entry) => entry.fields)).toStrictEqual([
      { entry: '1', name: 'VOLGA DAWN', imo: '9876505' },
      { entry: '2', name: 'NAYARA STAR', imo: '9123453' },
    ]);
  });
});

describe('the choice of the entry of a claim', () => {
  it('reads the CSV row of a text/csv page', () => {
    expect(entryForClaim(SDN_ROW, 'text/csv', 'Nayara Star')?.format).toBe('sdn_csv');
  });

  it('takes the entry of the act that has the label of the claim', () => {
    expect(entryForClaim(OJ_ACT, 'application/xml', 'Volga Dawn')?.effect).toBe('delete');
  });

  it('takes the annex entry that has the label of the claim', () => {
    expect(entryForClaim(ANNEX, 'text/plain', 'Nayara Star')?.fields['imo']).toBe('9123453');
  });

  it('reads no entry from a page that no parser reads', () => {
    expect(
      entryForClaim('The tanker Nayara Star left Sikka.', 'text/html', 'Nayara Star'),
    ).toBeNull();
  });
});
