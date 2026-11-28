// A document with no provider takes its level from the address rules (migration 0103). Each host
// of the signed list gets A. A near host, a page of the same host with no line and a web archive
// copy stay not verified. Each gesture runs inside a transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from './probe.ts';

const SIGNED = [
  'https://search-uk-sanctions-list.service.gov.uk/designations/RUS2357/Ship',
  'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv',
  'https://www.gov.uk/government/publications/the-uk-sanctions-list',
  'https://www.gov.uk/guidance/russia-list-of-designations-and-sanctions-notices',
  'https://www.gov.uk/government/publications/financial-sanctions-ukraine-sovereignty-and-territorial-integrity',
  'https://www.gov.uk/government/publications/ofsi-general-licence-int202611080040',
  'https://www.gov.uk/government/collections/enforcement-of-financial-sanctions',
  'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1095791/Notice_Russia_020822.pdf',
  'https://api.gleif.org/api/v1/lei-records/98450062DA43E94CC125',
  'https://api.gleif.org/api/v1/lei-records/98450062DA43E94CC125/direct-parent-relationship',
  'https://goldencopy.gleif.org/storage/golden-copy-files/2026/10/28/1294085/20261028-0800-gleif-goldencopy-rr-golden-copy.csv.zip',
  'https://sanctionssearch.ofac.treas.gov/Details.aspx?id=18300',
] as const;

const NEAR = [
  'https://search-uk-sanctions-list.service.gov.uk.example.org/designations/RUS2357/Ship',
  'https://www.gov.uk/government/news/uk-targets-sanctions-circumvention-and-crypto-networks-exploited-by-russia',
  'https://www.gov.uk/government/publications/the-uk-sanctions-list-of-something-else',
  'https://assets.publishing.service.gov.uk/media/653a4b0780884d0013f71bb0/JDP_2_00_Ed_4_web.pdf',
  'https://api.gleif.org.example.org/api/v1/lei-records/98450062DA43E94CC125',
  'https://www.gleif.org/en/about/this-is-gleif',
  'https://sanctionssearch.ofac.treas.gov.example.org/Details.aspx?id=18300',
  'https://sanctionssearch.ofac.treas.gov/Details.aspx?id=18300&next=https://example.org',
  'https://web.archive.org/web/20221027010229/https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1095791/Notice_Russia_020822.pdf',
  'https://web.archive.org/web/2026/https://api.gleif.org/api/v1/lei-records/98450062DA43E94CC125',
] as const;

const levels = z.array(z.object({ uri: z.string(), level: z.string() }));

const levelsOf = async (uris: readonly string[]): Promise<Record<string, string>> =>
  rolledBack('superuser', async (ask) => {
    await ask('SET LOCAL ROLE gabriel_app');
    for (const [n, uri] of uris.entries())
      await ask(
        `SELECT public.put_document($1, 'url', 'A level test', NULL, $2, NULL, NULL, NULL, NULL,
           NULL)`,
        [`doc_level_rule_${String(n)}`, uri],
      );
    await ask('RESET ROLE');
    const rows = levels.parse(
      await ask(
        `SELECT d.uri, m.level FROM public.documents d JOIN public.document_mark m USING (id)
          WHERE d.id LIKE 'doc_level_rule_%'`,
      ),
    );
    return Object.fromEntries(rows.map((row) => [row.uri, row.level]));
  });

test('a document of each host that the signed list rates A gets A with no provider', async () => {
  expect(await levelsOf(SIGNED)).toStrictEqual(Object.fromEntries(SIGNED.map((uri) => [uri, 'A'])));
});

test('a near host, a page with no line and a web archive copy stay not verified', async () => {
  expect(await levelsOf(NEAR)).toStrictEqual(
    Object.fromEntries(NEAR.map((uri) => [uri, 'not_verified'])),
  );
});
