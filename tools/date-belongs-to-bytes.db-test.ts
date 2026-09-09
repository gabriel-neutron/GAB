// Migration 0011 moved the retrieval date from the KIND of a document to its BYTES, and no test
// named the rule it replaced. A rule no test names is a rule a later tidy-up removes in silence:
// dropping the CHECK makes no test fail, and the first fabricated date arrives with no warning.
//
// THE RULE. A row that holds bytes carries the date they were taken. A row that is only an
// address carries nothing, and its absent date says NO DATE IS RECORDED — never that the page
// was not read. The v1 corpus needs the second half: 248 addresses, and v1 wrote no date.
//
// Each gesture opens a transaction, writes one row, asserts what the table did, and rolls back.
// `documents` rows cannot be deleted by any path in this schema, so the rollback is the only way
// back and no gesture may run outside one.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.string() }));

/** Runs one gesture inside a transaction that always rolls back. */
const gesture = <T>(work: (ask: Ask) => Promise<T>) =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

// The columns the rule reads, and nothing else. `title` is NOT NULL and refuses a blank, so it
// carries a word; no gesture below asserts anything about it.
interface Row {
  readonly kind: string;
  readonly s3Key: string | null;
  readonly sha256: string | null;
  readonly retrievedAt: string | null;
}

const SHA = 'a'.repeat(64);

const written = async (id: string, row: Row): Promise<unknown> =>
  gesture(async (ask) =>
    made.parse(
      await ask(
        `INSERT INTO documents (id, kind, title, s3_key, sha256, retrieved_at)
         VALUES ($1, $2, 'A rule of the retrieval date', $3, $4, $5) RETURNING id`,
        [id, row.kind, row.s3Key, row.sha256, row.retrievedAt],
      ),
    ),
  );

const REFUSED = { code: '23514', constraint: 'doc_retrieved_with_bytes' };

// ================================================== an address alone, which is the v1 case =====

// The whole reason the rule moved. 248 v1 addresses land through this row and invent no date.
test('an address with no bytes stands with no retrieval date', async () => {
  await expect(
    written('doc_addr', { kind: 'url', s3Key: null, sha256: null, retrievedAt: null }),
  ).resolves.toStrictEqual([{ id: 'doc_addr' }]);
});

// ============================================================ bytes, which demand a moment =====

test('a row that holds bytes and no retrieval date is refused', async () => {
  await expect(
    written('doc_bytes', { kind: 'file', s3Key: 'raw/x', sha256: SHA, retrievedAt: null }),
  ).rejects.toMatchObject(REFUSED);
});

test('a row that holds bytes and a retrieval date stands', async () => {
  await expect(
    written('doc_dated', { kind: 'file', s3Key: 'raw/x', sha256: SHA, retrievedAt: '2026-09-08' }),
  ).resolves.toStrictEqual([{ id: 'doc_dated' }]);
});

// THE TWO HALF-ROWS. The rule reads `s3_key IS NULL AND sha256 IS NULL`, so one column alone is
// enough to demand the date. An edit that makes the AND an OR passes every gesture above and
// fails these two: it would let a row holding an object carry no moment.
test('an object with no digest and no retrieval date is refused', async () => {
  await expect(
    written('doc_half_a', { kind: 'file', s3Key: 'raw/x', sha256: null, retrievedAt: null }),
  ).rejects.toMatchObject(REFUSED);
});

test('a digest with no object and no retrieval date is refused', async () => {
  await expect(
    written('doc_half_b', { kind: 'file', s3Key: null, sha256: SHA, retrievedAt: null }),
  ).rejects.toMatchObject(REFUSED);
});

// ============================================================ what the move made stricter =====

// The old rule read the kind, so `manual` escaped it whatever the row held. This row was lawful
// before migration 0011 and is a contradiction now: bytes were taken, and no moment is recorded.
test('a hand-entered row that holds bytes no longer escapes the date', async () => {
  await expect(
    written('doc_manual', { kind: 'manual', s3Key: 'raw/x', sha256: SHA, retrievedAt: null }),
  ).rejects.toMatchObject(REFUSED);
});

// ==================================================== the two rows the seed always carries =====

const reserved = z.array(
  z.object({ id: z.string(), s3_key: z.null(), sha256: z.null(), retrieved_at: z.null() }),
);

// 0011 states that 95_seed.sql needs no different row. This is that sentence as a measurement,
// and it reads the live table and not the file.
test('both reserved documents hold no bytes, so neither needs a date', async () => {
  const held = await probe('superuser', async (ask) =>
    reserved.parse(
      await ask(
        `SELECT id, s3_key, sha256, retrieved_at FROM documents
          WHERE id = ANY (reserved_doc_ids()) ORDER BY id`,
      ),
    ),
  );
  expect(held.map((row) => row.id)).toStrictEqual(['inherited', 'manual']);
});
