// The text of the data files of an API or of a statistics office: bytes and a type in, pages or a
// refusal out. The extracts come from real answers of Eurostat Comext (dataset DS-045409, July
// 2026) and of the ENTSOG transparency API.

import { describe, expect, test } from 'vitest';

import { extractText, jsonView, RefusedTextError, textPages } from './extract.ts';

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);
const pagesOf = async (text: string | Uint8Array, type: string): Promise<readonly string[]> =>
  (await extractText(typeof text === 'string' ? bytesOf(text) : text, type)).pages;

// The answer of Comext to the series M.HU+SK.RU.27090090.1.QUANTITY_IN_100KG, in TSV.
const COMEXT_TSV =
  'freq,reporter,partner,product,flow,indicators\\TIME_PERIOD\t2026-07 \n' +
  'M,HU,RU,27090090,1,QUANTITY_IN_100KG\t3272070.00\n' +
  'M,SK,RU,27090090,1,QUANTITY_IN_100KG\t4003080.00\n';

// The same query in SDMX-CSV.
const COMEXT_CSV =
  'DATAFLOW,LAST UPDATE,freq,reporter,partner,product,flow,indicators,TIME_PERIOD,OBS_VALUE\n' +
  'ESTAT:DS-045409(1.0),15/09/26 11:00:00,M,HU,RU,27090090,1,QUANTITY_IN_100KG,2026-07,3272070.00\n' +
  'ESTAT:DS-045409(1.0),15/09/26 11:00:00,M,SK,RU,27090090,1,QUANTITY_IN_100KG,2026-07,4003080.00\n';

// The same query in SDMX-ML (generic data), with the header cut short.
const COMEXT_XML =
  '<?xml version="1.0" encoding="UTF-8"?><m:GenericData ' +
  'xmlns:m="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message" ' +
  'xmlns:g="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic">' +
  '<m:Header><m:ID>066D5BACA967465AB09C82867519EC61</m:ID></m:Header>' +
  '<m:DataSet structureRef="STR1"><g:Series><g:SeriesKey><g:Value id="product" value="27090090"/>' +
  '<g:Value id="partner" value="RU"/><g:Value id="reporter" value="HU"/></g:SeriesKey><g:Obs>' +
  '<g:ObsDimension value="2026-07"/><g:ObsValue value="3272070.00"/></g:Obs></g:Series>' +
  '</m:DataSet></m:GenericData>';

// An ENTSOG answer of one line, cut to a few fields. ENTSOG writes "/" as the escape "\/".
const ENTSOG =
  '{"meta":{"limit":2,"total":2},"operationaldatas":[{"indicator":"Physical Flow",' +
  '"periodFrom":"2026-07-01T06:00:00+02:00","operatorLabel":"eustream","pointLabel":"Budince",' +
  '"directionKey":"exit","unit":"kWh\\/d","value":0,"isCamRelevant":false,"itemRemarks":null}]}';

describe('a data file is read as strict UTF-8 text', () => {
  test('a JSON file gives an indented view, with the keys in the order of the source', async () => {
    const source = '{"zeta":1,"alpha":{"b":[1,2],"a":"Budince"},"mid":true}';
    const bytes = bytesOf(source);
    const [page] = await pagesOf(bytes, 'application/json');
    expect(page).toBe(
      '{\n  "zeta": 1,\n  "alpha": {\n    "b": [\n      1,\n      2\n    ],\n' +
        '    "a": "Budince"\n  },\n  "mid": true\n}',
    );
    expect(JSON.parse(page ?? '')).toStrictEqual(JSON.parse(source));
    // The read leaves the bytes as they came.
    expect(new TextDecoder().decode(bytes)).toBe(source);
  });

  test('a vendor type that ends with +json is read as JSON', async () => {
    expect(await pagesOf('{"a":1}', 'application/vnd.sdmx.data+json; version=2.0')).toStrictEqual([
      '{\n  "a": 1\n}',
    ]);
  });

  test.each([
    ['the number 1.10', '{"rate":1.10}'],
    ['an identifier beyond double precision', '{"id":12345678901234567890}'],
    ['an escape that the view writes in another form', '{"name":"Caf\\u00e9"}'],
    ['the escape \\/ of an ENTSOG answer', ENTSOG],
    ['a duplicate key', '{"a":1,"a":2}'],
    ['a text that is no valid JSON', '{"a":1,'],
  ])('%s keeps the raw text of the whole file', async (_name, source) => {
    expect(await pagesOf(source, 'application/json')).toStrictEqual([source]);
  });

  test('an accent in a JSON string is read right, in the view', () => {
    expect(jsonView('{"name":"Ústí nad Labem"}')).toBe('{\n  "name": "Ústí nad Labem"\n}');
  });

  test('a Comext TSV table gives its rows, with the tab of each row', async () => {
    expect(await pagesOf(COMEXT_TSV, 'text/tab-separated-values')).toStrictEqual([COMEXT_TSV]);
  });

  test('a Comext SDMX-CSV table gives its rows', async () => {
    const [page] = await pagesOf(COMEXT_CSV, 'application/vnd.sdmx.data+csv; version=1.0.0');
    expect(page).toBe(COMEXT_CSV);
  });

  test('a Comext SDMX-ML file is read by the XML reader', async () => {
    const [page] = await pagesOf(COMEXT_XML, 'application/vnd.sdmx.genericdata+xml;version=2.1');
    expect(page).toContain('@value: 3272070.00');
    expect(page).toContain('@value: 27090090');
  });

  test('a plain text/* type that no other reader takes is read', async () => {
    expect(await pagesOf('Notice of the agency.', 'text/x-agency-notice')).toStrictEqual([
      'Notice of the agency.',
    ]);
  });

  test('a byte order mark is removed, so the first column name is clean', async () => {
    const bytes = Uint8Array.of(0xef, 0xbb, 0xbf, ...bytesOf('reporter,value\nHU,1\n'));
    const [page] = await pagesOf(bytes, 'text/csv');
    expect(page?.startsWith('reporter,')).toBe(true);
  });

  test('an accented text in a CSV file is read right', async () => {
    expect(await pagesOf('name\nŘeka Dunaj, Šaľa\n', 'text/csv')).toStrictEqual([
      'name\nŘeka Dunaj, Šaľa\n',
    ]);
  });

  test('a file with bad UTF-8 is refused with a reason', async () => {
    // "Šaľa" in windows-1250 is no UTF-8.
    const bytes = Uint8Array.of(...bytesOf('name\n'), 0x8a, 0x61, 0xbe, 0x61);
    await expect(extractText(bytes, 'text/csv')).rejects.toThrow(RefusedTextError);
    await expect(extractText(bytes, 'application/json')).rejects.toThrow(/not valid UTF-8/);
  });

  test('a file with a control character is refused, and tab, line feed and carriage return stay', async () => {
    await expect(extractText(bytesOf('a\u0001b'), 'text/plain')).rejects.toThrow(/U\+0001/);
    await expect(extractText(bytesOf('<a>\u001b</a>'), 'application/xml')).rejects.toThrow(
      RefusedTextError,
    );
    expect(await pagesOf('a\tb\r\nc\n', 'text/plain')).toStrictEqual(['a\tb\r\nc\n']);
  });
});

describe('a text above the page limit is cut at the end of a line', () => {
  test('a table repeats its header line on each page', () => {
    const header = 'reporter,value';
    const rows = ['HU,1', 'SK,2', 'CZ,3', 'AT,4'];
    const pages = textPages([header, ...rows].join('\n'), true, 25);
    expect(pages).toStrictEqual(['reporter,value\nHU,1\nSK,2', 'reporter,value\nCZ,3\nAT,4']);
  });

  test('a text that is not a table is cut with no header, and a text under the limit is one page', () => {
    expect(textPages('one\ntwo\nthree', false, 8)).toStrictEqual(['one\ntwo', 'three']);
    expect(textPages('one\ntwo', false, 7)).toStrictEqual(['one\ntwo']);
  });

  test('a line longer than a page is cut into pages, and no character is lost', () => {
    const pages = textPages('a'.repeat(20), false, 8);
    expect(pages.join('')).toBe('a'.repeat(20));
    expect(pages.every((page) => Buffer.byteLength(page) <= 8)).toBe(true);
  });
});
