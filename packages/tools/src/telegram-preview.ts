// The public preview of a channel, read with no account. It gives no numeric channel id and no
// edit date: it says only that a post was edited.

import { parseHTML } from 'linkedom';

import { parseTelegramAddress } from './telegram-address.ts';
import { ToolRefusal } from './tool.ts';

/** One post, as the preview shows it. */
export interface Post {
  readonly handle: string;
  readonly message_id: number;
  /** UTC, to the second. */
  readonly post_date: string;
  readonly edited: boolean;
  readonly forward_from_handle: string | null;
  /** NFC, LF line ends, and no space at the two ends. */
  readonly text: string;
  /** The kind of each media, in order. The tool downloads no media. */
  readonly media: readonly string[];
}

// Each class of a media block, in the words of the stored record. A link card is no media, so a
// post that changes only its link card is not a new version.
const MEDIA_BLOCKS: readonly (readonly [string, string])[] = [
  ['tgme_widget_message_photo_wrap', 'photo'],
  ['tgme_widget_message_roundvideo_player', 'round_video'],
  ['tgme_widget_message_video_player', 'video'],
  ['tgme_widget_message_voice_player', 'voice'],
  ['tgme_widget_message_document_wrap', 'document'],
  ['tgme_widget_message_sticker_wrap', 'sticker'],
  ['tgme_widget_message_poll', 'poll'],
  ['tgme_widget_message_location_wrap', 'location'],
  ['tgme_widget_message_contact_wrap', 'contact'],
  ['message_media_not_supported_wrap', 'other'],
];

const OUTSIDE = '.tgme_widget_message_link_preview, .tgme_widget_message_reply';

// The part of the tree of linkedom that this file reads. The package holds no DOM types, so the
// shape is stated here once, and the parser gives a document that fits it.
interface Part {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly textContent: string | null;
  readonly childNodes: ArrayLike<Part>;
  readonly classList: { contains(name: string): boolean };
  getAttribute(name: string): string | null;
  querySelector(selector: string): Part | null;
  querySelectorAll(selector: string): ArrayLike<Part>;
  closest(selector: string): Part | null;
}

// The preview draws a line break as <br> and an emoji as an element that holds its character.
// A link shows its visible text.
const plainText = (node: Part): string => {
  if (node.nodeType === 3) return node.textContent ?? '';
  if (node.nodeName === 'BR') return '\n';
  if (node.nodeType !== 1) return '';
  if (node.classList.contains('emoji')) return node.textContent ?? '';
  return Array.from(node.childNodes, plainText).join('');
};

const mediaOf = (bubble: Part): string[] => {
  const selector = MEDIA_BLOCKS.map(([name]) => `.${name}`).join(', ');
  return Array.from(bubble.querySelectorAll(selector))
    .filter((element) => element.closest(OUTSIDE) === null)
    .map((element) => {
      const kind = MEDIA_BLOCKS.find(([name]) => element.classList.contains(name))?.[1] ?? 'other';
      return kind === 'document' && element.querySelector('.audio') !== null ? 'audio' : kind;
    });
};

const forwardHandleOf = (bubble: Part): string | null => {
  const href = bubble
    .querySelector('.tgme_widget_message_forwarded_from_name')
    ?.getAttribute('href');
  if (href === null || href === undefined) return null;
  try {
    return parseTelegramAddress(href).handle;
  } catch {
    return null;
  }
};

const postOf = (message: Part): Post | null => {
  const [rawHandle, rawId] = (message.getAttribute('data-post') ?? '').split('/');
  const datetime = message
    .querySelector('.tgme_widget_message_date time')
    ?.getAttribute('datetime');
  if (rawHandle === undefined || rawId === undefined || datetime === null || datetime === undefined)
    return null;
  const id = Number(rawId);
  const date = new Date(datetime);
  if (!Number.isInteger(id) || id <= 0 || Number.isNaN(date.getTime())) return null;
  const bubble = message.querySelector('.tgme_widget_message_bubble') ?? message;
  const text = Array.from(bubble.querySelectorAll('.js-message_text')).find(
    (element) => element.closest(OUTSIDE) === null,
  );
  const meta = bubble.querySelector('.tgme_widget_message_meta')?.textContent ?? '';
  return {
    handle: rawHandle.toLowerCase(),
    message_id: id,
    post_date: `${date.toISOString().slice(0, 19)}Z`,
    edited: /\bedited\b/u.test(meta.trim()),
    forward_from_handle: forwardHandleOf(bubble),
    text: (text === undefined ? '' : plainText(text))
      .replace(/\r\n?/gu, '\n')
      .normalize('NFC')
      .trim(),
    media: mediaOf(bubble),
  };
};

const isPart = (value: unknown): value is Part =>
  typeof value === 'object' &&
  value !== null &&
  'querySelector' in value &&
  typeof value.querySelector === 'function';

// External constraint: the window of linkedom answers `document` from a trap, so `in` does not see it.
const documentOf = (html: string): Part => {
  const parsed: unknown = parseHTML(html);
  const document: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'document') : undefined;
  if (isPart(document)) return document;
  throw new Error('the HTML parser gave no document');
};

/** The posts of one page of the preview, newest first. */
export const readPreviewPage = (html: string): Post[] => {
  const document = documentOf(html);
  const messages = Array.from(document.querySelectorAll('.tgme_widget_message[data-post]'));
  if (messages.length === 0 && document.querySelector('.tgme_channel_info') === null)
    throw new ToolRefusal(
      'unreadable: the preview gave a page with no channel and no post, such as a check page, an ' +
        'error page or the page of a group. Nothing was stored. Check the handle, and name a ' +
        'public channel.',
    );
  return messages
    .map(postOf)
    .filter((post): post is Post => post !== null)
    .sort((a, b) => b.message_id - a.message_id);
};
