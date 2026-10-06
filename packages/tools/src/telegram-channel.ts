import { z } from 'zod';

import { storeFetched } from './fetch-document.ts';
import { parseTelegramAddress } from './telegram-address.ts';
import { readPreviewPage, type Post } from './telegram-preview.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { answerOf, UpstreamFault, webFromReach } from './web-access.ts';

// External constraint: a page of the public preview holds about twenty posts. The tool reads one
// page, so it cannot give more.
const PAGE_POSTS = 20;

// The key order is fixed by the literal, so a post gives the same bytes and the same hash each
// time it is read.
const recordOf = (post: Post): Uint8Array =>
  new TextEncoder().encode(
    JSON.stringify({
      handle: post.handle,
      message_id: post.message_id,
      post_date: post.post_date,
      text: post.text,
      media: post.media,
    }),
  );

const postOutput = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  url: z.string(),
  message_id: z.number().int(),
  post_date: z.string(),
  edited: z.boolean(),
  forward_from_handle: z.string().nullable(),
  media: z.array(z.string()),
  text: z.string(),
});

export const telegramChannel = defineTool({
  name: 'telegram_channel',
  description:
    'Reads posts of one public Telegram channel on its public preview (t.me/s), with no ' +
    'account, and stores each post as a document. Give "channel" as @handle, handle, t.me/handle ' +
    'or a t.me or tgstat.ru address of one post. With a post id (in the address or in ' +
    '"message_id"), the tool reads that post. With no post id, give "limit": the tool reads the ' +
    `newest posts of the channel, at most ${String(PAGE_POSTS)}, which is one page of the preview. ` +
    'A channel address alone is no source of one post, so cite the document of a post and never ' +
    'the channel. Each post is one document at https://t.me/<handle>/<id>, with the text of the ' +
    'post. A post whose bytes are already stored comes back as "known". An edited post is a new ' +
    'document at the same address. The tool downloads no media, and "media" lists the kinds. A ' +
    'channel that the preview does not show, such as a group or a private channel, is refused.',
  input: z.strictObject({
    channel: z.string().trim().min(1).max(2048),
    message_id: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('the id of one post; leave it out when the address names the post'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(PAGE_POSTS)
      .optional()
      .describe(`the count of newest posts to read, from 1 to ${String(PAGE_POSTS)}`),
  }),
  output: z.strictObject({ channel: z.string(), posts: z.array(postOutput) }),
  async run(session, input, reach) {
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no post');
    const web = webFromReach(reach);

    const address = parseTelegramAddress(input.channel);
    if (
      address.message_id !== undefined &&
      input.message_id !== undefined &&
      address.message_id !== input.message_id
    )
      throw new ToolRefusal(
        `message_id_conflict: the address names post ${address.message_id} and message_id is ` +
          `${input.message_id}. Give one post id.`,
      );
    const id = address.message_id ?? input.message_id;
    if (id === undefined && input.limit === undefined)
      throw new ToolRefusal(
        'channel_link_no_post: a channel address alone supports no claim. Give the post id ' +
          '(in the address or in message_id), or give limit to read the newest posts.',
      );

    // One post is on the page that ends just after it.
    const page = `https://t.me/s/${address.handle}${id === undefined ? '' : `?before=${id + 1}`}`;
    let body: string;
    try {
      ({ body } = await answerOf(web, page, { headers: { accept: 'text/html' } }));
    } catch (fault) {
      if (fault instanceof UpstreamFault)
        throw new ToolRefusal(`unreadable: ${fault.message}. Nothing was stored. Try again later.`);
      throw fault;
    }
    const shown = readPreviewPage(body);
    const found = shown.filter((post) => post.handle === address.handle);
    const other = shown[0]?.handle;
    if (found.length === 0 && other !== undefined)
      throw new ToolRefusal(
        `unreadable: the preview of ${address.handle} shows posts of ${other}. The channel was ` +
          `renamed or moved. Read ${other} instead, or check the handle. Nothing was stored.`,
      );
    const posts =
      id === undefined
        ? found.slice(0, input.limit)
        : found.filter((post) => post.message_id === id);
    if (id !== undefined && posts.length === 0)
      throw new ToolRefusal(
        `post ${id} is not on the public preview of ${address.handle}: it is deleted, or it is ` +
          'not a post of this channel. Check the post id. Nothing was stored.',
      );

    const day = reach.now().toISOString().slice(0, 10);
    const stored = [];
    for (const post of posts) {
      const url = `https://t.me/${post.handle}/${post.message_id}`;
      const document = await storeFetched(session, reach.store, {
        bytes: recordOf(post),
        mime: 'application/json',
        uri: url,
        title: `Telegram @${post.handle}, post ${post.message_id}`,
        pages: [post.text],
        day,
      });
      stored.push({
        document: document.id,
        status: document.status,
        url,
        message_id: post.message_id,
        post_date: post.post_date,
        edited: post.edited,
        forward_from_handle: post.forward_from_handle,
        media: [...post.media],
        text: post.text,
      });
    }
    return { channel: address.handle, posts: stored };
  },
});
