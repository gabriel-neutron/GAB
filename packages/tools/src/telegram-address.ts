import { ToolRefusal } from './tool.ts';

/** A channel by its handle, and a post when the address names one. */
export interface TelegramAddress {
  readonly handle: string;
  readonly message_id?: number;
}

// A public username: a letter first, then letters, digits and underscores. The handle is a key,
// so it is kept in lower case: Telegram reads a username without its case.
const HANDLE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/u;

const POST_ID = /^[1-9][0-9]{0,9}$/u;

const refused = (input: string, why: string): ToolRefusal =>
  new ToolRefusal(
    `"${input}" is no address of a public Telegram channel: ${why}. Write @handle, t.me/handle ` +
      'or t.me/handle/<post id>.',
  );

const addressOf = (input: string, handle: string, post: string | undefined): TelegramAddress => {
  if (!HANDLE.test(handle)) throw refused(input, `${handle} is not a channel username`);
  if (post === undefined) return { handle: handle.toLowerCase() };
  if (!POST_ID.test(post)) throw refused(input, `${post} is not a post id`);
  const id = Number(post);
  if (id > 2_147_483_647) throw refused(input, `${post} is not a post id`);
  return { handle: handle.toLowerCase(), message_id: id };
};

// tgstat is a mirror and a carrier: its address gives the handle and the post id, and the tool
// reads the post on t.me.
/** The handle and the post id of an accepted form, or a refusal. */
export const parseTelegramAddress = (raw: string): TelegramAddress => {
  const input = raw.trim();
  if (input === '') throw refused(raw, 'it is empty');
  if (!input.includes('/') && !input.includes('.')) {
    return addressOf(input, input.startsWith('@') ? input.slice(1) : input, undefined);
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//iu.test(input) ? input : `https://${input}`);
  } catch {
    throw refused(input, 'it is not an address');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./u, '');
  const parts = url.pathname.split('/').filter((part) => part !== '');
  if (host === 't.me' || host === 'telegram.me') {
    const path = parts[0] === 's' ? parts.slice(1) : parts;
    const [handle, post, ...rest] = path;
    if (handle === undefined || rest.length > 0) throw refused(input, 'the path is not a channel');
    return addressOf(input, handle, post);
  }
  if (host === 'tgstat.ru') {
    const path = parts[0] === 'channel' ? parts.slice(1) : parts;
    const [handle, post, ...rest] = path;
    if (handle?.startsWith('@') !== true || rest.length > 0)
      throw refused(input, 'the path is not a channel');
    return addressOf(input, handle.slice(1), post);
  }
  throw refused(input, `${host} is neither t.me nor tgstat.ru`);
};
