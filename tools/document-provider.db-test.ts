// A licence belongs to the provider that distributes the bytes, and the tier of a document is read
// from it. The rule fails closed: a document with no provider, an unknown document and a licence
// outside the allow-list are internal. Each gesture below runs inside a transaction that rolls
// back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from './probe.ts';

const SEEDED = [
  { id: 'acra', licence: 'paid-filing' },
  { id: 'copernicus_sentinel', licence: 'copernicus' },
  { id: 'crea', licence: 'restricted' },
  { id: 'cyprus_registrar', licence: 'paid-filing' },
  { id: 'datalastic', licence: 'commercial-no-redistribution' },
  { id: 'egrul', licence: 'restricted' },
  { id: 'equasis', licence: 'registration-terms' },
  { id: 'eu_eurlex', licence: 'eu-reuse' },
  { id: 'eu_fsf', licence: 'eu-reuse' },
  { id: 'gfw', licence: 'cc-by-nc-4.0' },
  { id: 'gleif', licence: 'cc0' },
  { id: 'hk_icris', licence: 'paid-filing' },
  { id: 'imo_gisis', licence: 'registration-terms' },
  { id: 'mca21', licence: 'paid-filing' },
  { id: 'ofac_sdn', licence: 'public-domain' },
  { id: 'opencorporates', licence: 'odbl' },
  { id: 'opensanctions', licence: 'cc-by-nc-4.0' },
  { id: 'osm', licence: 'odbl' },
  { id: 'own', licence: 'own' },
  { id: 'uk_sanctions_list', licence: 'ogl-v3' },
] as const;

const providers = z.array(z.object({ id: z.string(), licence: z.string() }));
const tiers = z.array(z.object({ tier: z.string() }));
const stored = z.array(z.object({ id: z.string(), provider_id: z.string().nullable() }));

/** The owner writes a document with no bytes, so the fixture needs no object in the store. */
const PUT_BARE = `SELECT public.put_document($1, 'url', 'A provider test', NULL,
  'https://example.org/' || $1, NULL, NULL, NULL, NULL, $2) AS id`;

const asOwner = async (ask: Ask): Promise<void> => {
  await ask('SET LOCAL ROLE gabriel_owner');
};

const tierOf = async (ask: Ask, document: string): Promise<string> => {
  const [row] = tiers.parse(await ask('SELECT public.document_tier($1) AS tier', [document]));
  if (row === undefined) throw new Error('the tier function returned no row');
  return row.tier;
};

const providerOf = async (ask: Ask, document: string): Promise<readonly unknown[]> =>
  stored.parse(await ask('SELECT id, provider_id FROM public.documents WHERE id = $1', [document]));

test('the seed holds the twenty providers of the ticket, each with its licence', async () => {
  const found = await probe('superuser', async (ask) =>
    providers.parse(await ask('SELECT id, licence FROM public.document_provider ORDER BY id')),
  );
  expect(found).toStrictEqual(SEEDED);
});

test('a licence outside the closed list is refused', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      await asOwner(ask);
      await ask(
        "INSERT INTO public.document_provider (id, name, licence) VALUES ('nope', 'Nope', 'mit')",
      );
    }),
  ).rejects.toMatchObject({ code: '23514' });
});

test('put_document stores the provider that it gets', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await ask('SET LOCAL ROLE gabriel_app');
    await ask(PUT_BARE, ['doc_provider_door', 'ofac_sdn']);
    return providerOf(ask, 'doc_provider_door');
  });
  expect(found).toStrictEqual([{ id: 'doc_provider_door', provider_id: 'ofac_sdn' }]);
});

const SHA = 'f'.repeat(64);

test('put_fetched_document stores the provider that it gets', async () => {
  const found = await rolledBack('research', async (ask) => {
    await ask(
      `SELECT public.put_fetched_document('api', 'A GLEIF record', $1, 'https://api.gleif.org/x',
         $2, 'application/json', '2026-10-05'::date, NULL, 'gleif')`,
      [`raw/${SHA}`, SHA],
    );
    return providerOf(ask, `doc_${SHA.slice(0, 12)}`);
  });
  expect(found).toStrictEqual([{ id: `doc_${SHA.slice(0, 12)}`, provider_id: 'gleif' }]);
});

for (const kind of ['url', 'api'] as const)
  test(`a ${kind} document with no provider is stored, and it is internal`, async () => {
    const found = await rolledBack('superuser', async (ask) => {
      await ask('SET LOCAL ROLE gabriel_research');
      const sha = (kind === 'url' ? 'a' : 'b').repeat(64);
      await ask(
        `SELECT public.put_fetched_document($1, 'No provider', $2, 'https://example.org/none',
           $3, 'text/html', '2026-10-05'::date)`,
        [kind, `raw/${sha}`, sha],
      );
      await ask('RESET ROLE');
      const id = `doc_${sha.slice(0, 12)}`;
      return { row: await providerOf(ask, id), tier: await tierOf(ask, id) };
    });
    expect(found.row).toHaveLength(1);
    expect(found.row[0]).toMatchObject({ provider_id: null });
    expect(found.tier).toBe('internal');
  });

// The foreign key is the one rule for an unknown provider. Its message names the constraint, and
// its detail names the value, so a caller reads the id there.
test('an unknown provider is refused, and no row is written', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await ask('SAVEPOINT before_put');
    let refusal: unknown = null;
    try {
      await ask('SET LOCAL ROLE gabriel_app');
      await ask(PUT_BARE, ['doc_provider_unknown', 'no_such_provider']);
    } catch (error) {
      refusal = error;
    }
    await ask('ROLLBACK TO SAVEPOINT before_put');
    await ask('RESET ROLE');
    return { refusal, row: await providerOf(ask, 'doc_provider_unknown') };
  });
  const refusal = z.object({ code: z.string(), detail: z.string() }).parse(found.refusal);
  expect(refusal.code).toBe('23503');
  expect(refusal.detail).toContain('no_such_provider');
  expect(found.row).toStrictEqual([]);
});

const FIXTURE = [
  { id: 'doc_tier_equasis', provider: 'equasis', tier: 'internal' },
  { id: 'doc_tier_ais', provider: 'datalastic', tier: 'internal' },
  { id: 'doc_tier_none', provider: null, tier: 'internal' },
  { id: 'doc_tier_gfw', provider: 'gfw', tier: 'internal' },
  { id: 'doc_tier_filing', provider: 'mca21', tier: 'internal' },
  { id: 'doc_tier_ofac', provider: 'ofac_sdn', tier: 'cc-by' },
  { id: 'doc_tier_own', provider: 'own', tier: 'cc-by' },
] as const;

test('the tier is cc-by only for a document whose provider has a licence of the allow-list', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await asOwner(ask);
    for (const row of FIXTURE) await ask(PUT_BARE, [row.id, row.provider]);
    const out: Record<string, string> = {};
    for (const row of FIXTURE) out[row.id] = await tierOf(ask, row.id);
    return out;
  });
  expect(found).toStrictEqual(Object.fromEntries(FIXTURE.map((row) => [row.id, row.tier])));
});

// The reserved row says that nothing here supports the value, so no provider makes it public.
test('the reserved document inherited is internal, also with the provider own', async () => {
  const tier = await rolledBack('superuser', async (ask) => {
    await asOwner(ask);
    await ask("UPDATE public.documents SET provider_id = 'own' WHERE id = 'inherited'");
    return tierOf(ask, 'inherited');
  });
  expect(tier).toBe('internal');
});

test('an id that names no document is internal', async () => {
  const tier = await rolledBack('superuser', (ask) => tierOf(ask, 'doc_that_does_not_exist'));
  expect(tier).toBe('internal');
});

const snapshot = z.array(z.object({ id: z.string(), xmin: z.string(), row: z.unknown() }));

const SNAPSHOT = `SELECT d.id, d.xmin::text AS xmin, to_jsonb(d) AS row
  FROM public.documents d WHERE d.id = ANY($1::text[]) ORDER BY d.id`;

// One edit of the provider row moves every document of that provider, and no document row is
// rewritten.
test('a new licence on the GFW row moves both GFW documents to cc-by, and no document changes', async () => {
  const ids = ['doc_tier_gfw_a', 'doc_tier_gfw_b'];
  const found = await rolledBack('superuser', async (ask) => {
    await asOwner(ask);
    for (const id of ids) await ask(PUT_BARE, [id, 'gfw']);
    const before = snapshot.parse(await ask(SNAPSHOT, [ids]));
    const tiersBefore: string[] = [];
    for (const id of ids) tiersBefore.push(await tierOf(ask, id));
    // The edit runs in a subtransaction with its own transaction id, so a document row that it
    // rewrote would show a new xmin.
    await ask('SAVEPOINT before_edit');
    await ask("UPDATE public.document_provider SET licence = 'cc-by-4.0' WHERE id = 'gfw'");
    const after = snapshot.parse(await ask(SNAPSHOT, [ids]));
    const tiersAfter: string[] = [];
    for (const id of ids) tiersAfter.push(await tierOf(ask, id));
    return { before, after, tiersBefore, tiersAfter };
  });
  expect(found.tiersBefore).toStrictEqual(['internal', 'internal']);
  expect(found.tiersAfter).toStrictEqual(['cc-by', 'cc-by']);
  expect(found.after).toHaveLength(2);
  expect(found.after).toStrictEqual(found.before);
});
