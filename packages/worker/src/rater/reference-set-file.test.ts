import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import { writtenSet } from './reference-set.ts';

const file = JSON.parse(
  readFileSync(new URL('./reference-set.json', import.meta.url), 'utf8'),
) as unknown;

test('the written set passes the rules of a written set', () => {
  expect(writtenSet.safeParse(file).success).toBe(true);
});

test('the written set holds the letters that the operator approved', () => {
  const set = writtenSet.parse(file);
  const count = (letter: string): number =>
    set.authors.filter((one) => one.letter === letter).length;

  expect(['A', 'B', 'C', 'D', 'E', 'F'].map(count)).toStrictEqual([12, 14, 8, 4, 2, 1]);
  expect(set.authors).toHaveLength(41);
});

test('each author A of the written set has the sites where it publishes its own records, or none', () => {
  const set = writtenSet.parse(file);

  expect(
    set.authors.filter((one) => one.letter === 'A').map((one) => [one.name, one.sites]),
  ).toStrictEqual([
    ['Official Journal of the European Union', ['eur-lex.europa.eu', 'publications.europa.eu']],
    ['OFAC (US Treasury)', ['ofac.treasury.gov', 'ofac.treas.gov', 'home.treasury.gov']],
    ['Companies House (UK)', ['company-information.service.gov.uk']],
    ['European Court of Human Rights', ['echr.coe.int']],
    [
      'FCDO (UK Foreign, Commonwealth & Development Office)',
      ['sanctionslist.fcdo.gov.uk', 'search-uk-sanctions-list.service.gov.uk'],
    ],
    // www.gov.uk holds the pages of each UK department, so it is no site of one author.
    ['OFSI (HM Treasury)', []],
    ['US Department of State', ['state.gov', 'govinfo.gov', 'federalregister.gov']],
    [
      'BIS (US Department of Commerce)',
      ['bis.gov', 'bis.doc.gov', 'govinfo.gov', 'federalregister.gov'],
    ],
    [
      'US President (Executive Office of the President)',
      ['whitehouse.gov', 'govinfo.gov', 'federalregister.gov'],
    ],
    [
      'European Commission (EU executive)',
      ['ec.europa.eu', 'finance.ec.europa.eu', 'webgate.ec.europa.eu'],
    ],
    ['General Court of the European Union (CJEU)', ['curia.europa.eu']],
    ['GLEIF (Global Legal Entity Identifier Foundation)', ['gleif.org', 'api.gleif.org']],
  ]);
});
