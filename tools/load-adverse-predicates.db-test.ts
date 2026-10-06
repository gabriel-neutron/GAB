// The loader reads one CSV file of rules and loads it through the door as gabriel_app. Each test
// runs the loader inside a transaction that rolls back. The fixture file is invented and small.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, test } from 'vitest';
import { z } from 'zod';

import { anEntity, aPair, asRole, runChecks, spanOf } from './evidence-fixture.ts';
import { loadAdversePredicates } from './load-adverse-predicates.ts';
import { rolledBack, type Ask } from './probe.ts';

const FIXTURE = new URL('./fixtures/adverse-predicates.csv', import.meta.url).pathname;

const folders: string[] = [];

afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

const asApp = (ask: Ask, file: string): Promise<string> =>
  asRole(ask, 'gabriel_app', () => loadAdversePredicates(file, ask));

test('the loader reads the fixture file as one load', async () => {
  const rows = await rolledBack('superuser', async (ask) => {
    const load = await asApp(ask, FIXTURE);
    return z.array(z.object({ n: z.string(), files: z.string() })).parse(
      await ask(
        `SELECT count(*)::text AS n, string_agg(DISTINCT source_file, ',') AS files
             FROM public.adverse_predicate_rule WHERE load_id = $1`,
        [load],
      ),
    );
  });
  expect(rows).toStrictEqual([{ n: '5', files: 'adverse-predicates.csv' }]);
});

test('the loader refuses a file with a predicate outside the closed list, and loads no row of it', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'gab-adverse-'));
  folders.push(folder);
  const file = join(folder, 'bad.csv');
  await writeFile(
    file,
    'row_kind,subject_kind,predicate,class,lang,keyword,key\n' +
      'key,vessel,belligerent_listing,official_act,,,gur_listed\n' +
      'keyword,vessel,fraud,adverse_allegation,eng,fraud,\n',
  );
  await expect(rolledBack('superuser', (ask) => asApp(ask, file))).rejects.toMatchObject({
    code: '23514',
  });
});

test('a fixture claim with the attribute gur_listed gets the predicate of its row', async () => {
  const page = 'The tanker Nayara Star, owned by Sikka Shipping, is on the list of the agency.';
  const found = await rolledBack('superuser', async (ask) => {
    await asApp(ask, FIXTURE);
    const pair = await aPair(ask, {
      document: 'doc_adverse_loader',
      page,
      payload: { type: 'vessel', label: 'Nayara Star', attrs: { gur_listed: true } },
      span: spanOf(page, page),
      before: async (inner, document) => {
        await anEntity(inner, document, 'company', 'Sikka Shipping');
      },
    });
    await runChecks(ask, pair.evidence, pair.claim);
    return ask(
      'SELECT party_label, predicate, class FROM public.adverse_predicate WHERE claim_id = $1',
      [pair.claim],
    );
  });
  expect(found).toStrictEqual([
    { party_label: 'Sikka Shipping', predicate: 'belligerent_listing', class: 'official_act' },
  ]);
});

test('gabriel_agent cannot run the loader', async () => {
  await expect(
    rolledBack('agent', (ask) => loadAdversePredicates(FIXTURE, ask)),
  ).rejects.toMatchObject({ code: '42501' });
});
