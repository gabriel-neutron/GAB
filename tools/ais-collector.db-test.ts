// The Baltic AIS collector against the disposable database as gabriel_research. Each new answer at
// the one address of an endpoint must be its own document. The object store is in memory, and the
// call rolls back.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { memoryStore } from '@gab/tools/fetch-fixture';
import { stubWeb, text, type Asked } from '@gab/tools/web-stub';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { lineShape, pull } from './ais-collector.ts';
import { rolledBack } from './probe.ts';

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const bodyOf = (word: string, asked: Asked) =>
  asked.url.pathname.endsWith('vessels')
    ? `[ { "run" : "${RUN}-${word}" } ]`
    : `{ "features" : [ { "run" : "${RUN}-${word}" } ] }`;

const rows = z.array(z.object({ uri: z.string(), mime: z.string(), page: z.string() }));

test('other bytes give another document, the same bytes give one, and the text is the answer', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'ais-collector-db-'));
  try {
    await rolledBack('research', async (ask) => {
      const session = {
        query: async (query: string, values: unknown[]) => ({ rows: await ask(query, values) }),
      };
      for (const word of ['first', 'second', 'second'])
        expect(
          await pull(
            session,
            {
              store: memoryStore(),
              web: stubWeb((asked) => text(bodyOf(word, asked))),
              now: () => new Date(),
            },
            folder,
          ),
        ).toBe(true);

      const lines = readFileSync(join(folder, 'ais-checkpoint.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => lineShape.parse(JSON.parse(line)))
        .filter((line) => line.endpoint === 'vessels');
      expect(lines.map((line) => line.status)).toEqual(['stored', 'stored', 'known']);
      expect(lines[1]?.document).not.toBe(lines[0]?.document);
      expect(lines[2]?.document).toBe(lines[1]?.document);

      const [stored] = rows.parse(
        await ask(
          `SELECT d.uri, d.mime, t.text AS page
             FROM public.documents d JOIN public.document_text t ON t.document_id = d.id
            WHERE d.sha256 = $1`,
          [lines[1]?.sha256],
        ),
      );
      expect(stored).toEqual({
        uri: 'https://meri.digitraffic.fi/api/ais/v1/vessels',
        mime: 'application/json',
        page: `[ { "run" : "${RUN}-second" } ]`,
      });
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
