// The Telegram tool against the disposable database as gabriel_research. The web is a stub, so no
// request leaves the machine. Each call runs inside a transaction that rolls back.

import { createHash } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { fixtureReach, memoryStore } from './fetch-fixture.ts';
import {
  LINK_POST,
  NO_CHANNEL_PAGE,
  PHOTO_POST,
  previewPage,
  SILENT_POST,
  type FixturePost,
} from './telegram-fixture.ts';
import { stubWeb, text } from './web-stub.ts';
import { callTool, type Session, type Tool } from './tool.ts';

// Each run gets other bytes, so no row of an earlier run makes a post known.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const HANDLE = `gab_test_${RUN}`;

const run = (post: FixturePost): FixturePost => ({
  ...post,
  html: post.html === '' ? '' : `${post.html} Run ${RUN}.`,
});
const PHOTO = run(PHOTO_POST);
const LINK = run(LINK_POST);
const SILENT = SILENT_POST;

const telegramChannel = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'telegram_channel');
  if (found === undefined) throw new Error('the catalogue holds no tool named telegram_channel');
  return found;
})();

const sessionOf = (ask: Ask): Session => ({
  query: async (query, values) => ({ rows: await ask(query, values) }),
});

const answer = z.object({
  channel: z.string(),
  posts: z.array(
    z.object({
      document: z.string(),
      status: z.enum(['known', 'stored']),
      url: z.string(),
      message_id: z.number(),
      post_date: z.string(),
      edited: z.boolean(),
      forward_from_handle: z.string().nullable(),
      media: z.array(z.string()),
      text: z.string(),
    }),
  ),
});

const setup = (page: (url: URL) => string) => {
  const store = memoryStore();
  const web = stubWeb(({ url }) => text(page(url), 200, { 'content-type': 'text/html' }));
  return { store, web, reach: { ...fixtureReach(store), web } };
};

const shaOf = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');

const read = async (ask: Ask, input: unknown, reach: ReturnType<typeof setup>['reach']) => {
  const outcome = await callTool(telegramChannel, sessionOf(ask), input, reach);
  if (!outcome.ok) throw new Error(`telegram_channel refused: ${outcome.refusal}`);
  return answer.parse(outcome.output);
};

const refusal = async (ask: Ask, input: unknown, reach: ReturnType<typeof setup>['reach']) => {
  const outcome = await callTool(telegramChannel, sessionOf(ask), input, reach);
  if (outcome.ok) throw new Error('telegram_channel answered, and it had to refuse');
  return outcome.refusal;
};

const ALL = [PHOTO, LINK, SILENT];

test('a read of the newest posts stores each post once, and a second read returns them as known', async () => {
  const { store, web, reach } = setup(() => previewPage(HANDLE, ALL));
  await rolledBack('research', async (ask) => {
    const first = await read(ask, { channel: `@${HANDLE}`, limit: 3 }, reach);
    expect(web.asked.map((asked) => asked.url.href)).toStrictEqual([`https://t.me/s/${HANDLE}`]);
    expect(first.channel).toBe(HANDLE);
    expect(first.posts.map((post) => [post.message_id, post.status])).toStrictEqual([
      [2043, 'stored'],
      [2042, 'stored'],
      [2041, 'stored'],
    ]);
    const photo = first.posts.find((post) => post.message_id === 2042);
    expect(photo).toMatchObject({
      url: `https://t.me/${HANDLE}/2042`,
      post_date: '2026-10-01T12:00:00Z',
      edited: true,
      forward_from_handle: 'origin_channel',
      media: ['photo'],
    });
    expect(photo?.text).toContain(`Run ${RUN}.`);
    expect(store.puts).toHaveLength(3);

    const rows = await ask(
      `SELECT d.id::text AS id, d.kind, d.uri, d.mime, d.retrieved_at::text AS retrieved_at,
              (SELECT string_agg(t.text, '' ORDER BY t.page)
                 FROM public.document_text t WHERE t.document_id = d.id) AS text
         FROM public.documents d WHERE d.uri = $1`,
      [`https://t.me/${HANDLE}/2042`],
    );
    expect(rows).toStrictEqual([
      {
        id: photo?.document,
        kind: 'url',
        uri: `https://t.me/${HANDLE}/2042`,
        mime: 'application/json',
        retrieved_at: '2026-10-05',
        text: photo?.text,
      },
    ]);

    const second = await read(ask, { channel: HANDLE, limit: 3 }, reach);
    expect(second.posts.map((post) => post.status)).toStrictEqual(['known', 'known', 'known']);
    expect(second.posts.map((post) => post.document)).toStrictEqual(
      first.posts.map((post) => post.document),
    );
    expect(store.puts).toHaveLength(3);
  });
});

test('the stored bytes are one record with a fixed key order, so the hash does not depend on the page', async () => {
  const { store, reach } = setup(() => previewPage(HANDLE, [PHOTO]));
  await rolledBack('research', async (ask) => {
    const { posts } = await read(ask, { channel: HANDLE, limit: 1 }, reach);
    const put = store.puts[0];
    const record = JSON.parse(Buffer.from(put?.bytes ?? []).toString('utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(record)).toStrictEqual([
      'handle',
      'message_id',
      'post_date',
      'text',
      'media',
    ]);
    expect(record['media']).toStrictEqual(['photo']);
    expect(put?.key).toBe(`raw/${shaOf(put?.bytes ?? '')}`);
    expect(posts[0]?.document).toBe(`doc_${shaOf(put?.bytes ?? '').slice(0, 12)}`);
  });
});

test('a post with a photo and no text is stored', async () => {
  const { reach } = setup(() => previewPage(HANDLE, [SILENT]));
  await rolledBack('research', async (ask) => {
    const { posts } = await read(ask, { channel: HANDLE, limit: 1 }, reach);
    expect(posts[0]).toMatchObject({ status: 'stored', text: '', media: ['photo'] });
  });
});

test('an address with a post id reads that post alone, from the page that ends after it', async () => {
  const { store, web, reach } = setup(() => previewPage(HANDLE, ALL));
  await rolledBack('research', async (ask) => {
    const { posts } = await read(ask, { channel: `https://tgstat.ru/@${HANDLE}/2042` }, reach);
    expect(web.asked.map((asked) => asked.url.href)).toStrictEqual([
      `https://t.me/s/${HANDLE}?before=2043`,
    ]);
    expect(posts.map((post) => post.message_id)).toStrictEqual([2042]);
    expect(store.puts).toHaveLength(1);
  });
});

test('a post id in the input reads that post', async () => {
  const { reach } = setup(() => previewPage(HANDLE, ALL));
  await rolledBack('research', async (ask) => {
    const { posts } = await read(ask, { channel: HANDLE, message_id: 2043 }, reach);
    expect(posts.map((post) => post.message_id)).toStrictEqual([2043]);
  });
});

test('a post that the page does not hold is refused with what to correct, and nothing is stored', async () => {
  const { store, reach } = setup(() => previewPage(HANDLE, ALL));
  await rolledBack('research', async (ask) => {
    const said = await refusal(ask, { channel: HANDLE, message_id: 99 }, reach);
    expect(said).toMatch(/post 99/u);
    expect(said).toMatch(/Check the post id/u);
    expect(store.puts).toHaveLength(0);
  });
});

test('a post that is edited later is a new document at the same address', async () => {
  let page = previewPage(HANDLE, [PHOTO]);
  const { store, reach } = setup(() => page);
  await rolledBack('research', async (ask) => {
    const first = await read(ask, { channel: HANDLE, limit: 1 }, reach);
    page = previewPage(HANDLE, [{ ...PHOTO, html: `${PHOTO.html} And a correction.` }]);
    const second = await read(ask, { channel: HANDLE, limit: 1 }, reach);
    expect(second.posts[0]?.status).toBe('stored');
    expect(second.posts[0]?.document).not.toBe(first.posts[0]?.document);
    expect(second.posts[0]?.url).toBe(first.posts[0]?.url);
    expect(store.puts).toHaveLength(2);
  });
});

test('a channel with no post and no limit is refused before any request', async () => {
  const { store, web, reach } = setup(() => previewPage(HANDLE, ALL));
  await rolledBack('research', async (ask) => {
    const said = await refusal(ask, { channel: `t.me/${HANDLE}` }, reach);
    expect(said).toMatch(/channel_link_no_post/u);
    expect(said).toMatch(/message_id|limit/u);
    expect(web.asked).toHaveLength(0);
    expect(store.puts).toHaveLength(0);
  });
});

test('two different post ids are refused before any request', async () => {
  const { web, reach } = setup(() => previewPage(HANDLE, ALL));
  await rolledBack('research', async (ask) => {
    const said = await refusal(ask, { channel: `t.me/${HANDLE}/2042`, message_id: 2043 }, reach);
    expect(said).toMatch(/message_id_conflict/u);
    expect(web.asked).toHaveLength(0);
  });
});

test('an address that is no public channel is refused before any request', async () => {
  const { web, reach } = setup(() => previewPage(HANDLE, ALL));
  await rolledBack('research', async (ask) => {
    const said = await refusal(ask, { channel: 'https://example.org/a/1', limit: 1 }, reach);
    expect(said).toMatch(/no address of a public Telegram channel/u);
    expect(web.asked).toHaveLength(0);
  });
});

test('a page with no channel is refused as unreadable, and nothing is stored', async () => {
  const { store, reach } = setup(() => NO_CHANNEL_PAGE);
  await rolledBack('research', async (ask) => {
    const said = await refusal(ask, { channel: HANDLE, limit: 1 }, reach);
    expect(said).toMatch(/^unreadable/u);
    expect(store.puts).toHaveLength(0);
  });
});

test('a server fault is refused as unreadable, and nothing is stored', async () => {
  const store = memoryStore();
  const web = stubWeb(() => text('busy', 503));
  await rolledBack('research', async (ask) => {
    const said = await refusal(ask, { channel: HANDLE, limit: 1 }, { ...fixtureReach(store), web });
    expect(said).toMatch(/^unreadable.*503/u);
    expect(store.puts).toHaveLength(0);
  });
});

test('a redirect is refused as unreadable, and nothing is stored', async () => {
  const store = memoryStore();
  const web = stubWeb(() => text('', 302, { location: 'https://t.me/s/elsewhere' }));
  await rolledBack('research', async (ask) => {
    const said = await refusal(ask, { channel: HANDLE, limit: 1 }, { ...fixtureReach(store), web });
    expect(said).toMatch(/^unreadable.*302/u);
    expect(store.puts).toHaveLength(0);
  });
});

test('a page of posts of another handle is refused with the other handle, and nothing is stored', async () => {
  const { store, reach } = setup(() => previewPage('renamed_channel', ALL));
  await rolledBack('research', async (ask) => {
    const said = await refusal(ask, { channel: HANDLE, limit: 3 }, reach);
    expect(said).toMatch(/^unreadable/u);
    expect(said).toContain('renamed_channel');
    expect(said).toMatch(/renamed or moved/u);
    expect(store.puts).toHaveLength(0);
  });
});

test('a limit above the posts of one page is refused with the cap', async () => {
  const { reach } = setup(() => previewPage(HANDLE, ALL));
  await rolledBack('research', async (ask) => {
    expect(await refusal(ask, { channel: HANDLE, limit: 21 }, reach)).toMatch(/limit/u);
  });
});
