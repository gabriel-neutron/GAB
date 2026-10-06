import { expect, test } from 'vitest';

import {
  LINK_POST,
  NO_CHANNEL_PAGE,
  PHOTO_POST,
  previewPage,
  SILENT_POST,
} from './telegram-fixture.ts';
import { readPreviewPage } from './telegram-preview.ts';
import { ToolRefusal } from './tool.ts';

const PAGE = previewPage('SpecnazAkhmat', [SILENT_POST, PHOTO_POST, LINK_POST]);

test('a page gives its posts, newest first, with the handle in lower case', () => {
  const posts = readPreviewPage(PAGE);
  expect(posts.map((post) => [post.handle, post.message_id])).toStrictEqual([
    ['specnazakhmat', 2043],
    ['specnazakhmat', 2042],
    ['specnazakhmat', 2041],
  ]);
});

test('a post gives its text, date, media, forward origin and mark of an edit', () => {
  const post = readPreviewPage(PAGE).find((found) => found.message_id === 2042);
  expect(post).toStrictEqual({
    handle: 'specnazakhmat',
    message_id: 2042,
    post_date: '2026-10-01T12:00:00Z',
    edited: true,
    forward_from_handle: 'origin_channel',
    text: 'A hull at the Kozmino berth.\nSecond line \u{1F6A2} example.com/notice',
    media: ['photo'],
  });
});

test('a link card is no media and its text is no text of the post', () => {
  const post = readPreviewPage(PAGE).find((found) => found.message_id === 2043);
  expect(post?.media).toStrictEqual([]);
  expect(post?.text).toBe('Port notice: https://port.example/notice/7');
  expect(post?.edited).toBe(false);
});

test('a post with a photo and no text gives an empty text', () => {
  const post = readPreviewPage(PAGE).find((found) => found.message_id === 2041);
  expect(post?.text).toBe('');
  expect(post?.media).toStrictEqual(['photo']);
});

test('a page with no channel and no post is refused, and the refusal says what to correct', () => {
  expect(() => readPreviewPage(NO_CHANNEL_PAGE)).toThrow(ToolRefusal);
  expect(() => readPreviewPage(NO_CHANNEL_PAGE)).toThrow(/Check the handle/u);
});

test('a channel with no post gives no post', () => {
  expect(readPreviewPage(previewPage('quiet_channel', []))).toStrictEqual([]);
});
