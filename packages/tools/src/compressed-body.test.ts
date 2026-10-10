import { brotliCompressSync, deflateRawSync, deflateSync, gzipSync } from 'node:zlib';

import { describe, expect, test } from 'vitest';

import { binaryBytes, decodedBody } from './compressed-body.ts';
import { ToolRefusal } from './tool.ts';

const PAGE = new TextEncoder().encode(
  '<html><head><title>OFSI general licences</title></head><body><p>General licences.</p></body></html>',
);
const MAX = 1_000_000;

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('a body that the header names as compressed is decoded', () => {
  test.each([
    ['gzip', gzipSync(PAGE)],
    ['x-gzip', gzipSync(PAGE)],
    ['deflate', deflateSync(PAGE)],
    ['br', brotliCompressSync(PAGE)],
    ['GZIP', gzipSync(PAGE)],
  ])('%s', (name, body) => {
    expect(text(decodedBody(body, name, 'text/html', MAX))).toBe(text(PAGE));
  });

  test('a raw deflate stream, as some servers send it', () => {
    expect(text(decodedBody(deflateRawSync(PAGE), 'deflate', 'text/html', MAX))).toBe(text(PAGE));
  });

  test('two encodings are decoded, the last one first', () => {
    const body = brotliCompressSync(gzipSync(PAGE));
    expect(text(decodedBody(body, 'gzip, br', 'text/html', MAX))).toBe(text(PAGE));
  });

  test('identity and no header leave the body as it came', () => {
    expect(decodedBody(PAGE, 'identity', 'text/html', MAX)).toBe(PAGE);
    expect(decodedBody(PAGE, null, 'text/html', MAX)).toBe(PAGE);
  });

  test('a body larger than the cap when it is decoded is refused', () => {
    const big = gzipSync(new Uint8Array(MAX + 1).fill(0x41));
    expect(() => decodedBody(big, 'gzip', 'text/plain', MAX)).toThrow(ToolRefusal);
    expect(() => decodedBody(big, null, 'text/plain', MAX)).toThrow(/larger than/);
  });
});

describe('a compressed body with no header is found by its first bytes', () => {
  test.each([
    ['gzip', gzipSync(PAGE)],
    ['zlib', deflateSync(PAGE)],
    ['brotli', brotliCompressSync(PAGE)],
    ['gzip in gzip', gzipSync(gzipSync(PAGE))],
  ])('%s', (_name, body) => {
    expect(text(decodedBody(body, null, 'text/html', MAX))).toBe(text(PAGE));
  });

  test('a body with no type and no header is decoded', () => {
    expect(text(decodedBody(gzipSync(PAGE), null, null, MAX))).toBe(text(PAGE));
  });

  test('a gzip file that the server names as gzip stays as it came', () => {
    const file = gzipSync(PAGE);
    expect(decodedBody(file, null, 'application/gzip', MAX)).toBe(file);
  });

  test('a text that opens with the bytes of a zlib header stays as it came', () => {
    const page = new TextEncoder().encode('x^ is a formula, and this page is text.');
    expect(decodedBody(page, null, 'text/plain', MAX)).toBe(page);
  });
});

describe('binary bytes are told apart from text', () => {
  test('a page in UTF-8, in a charset of one byte and in UTF-16 is text', () => {
    expect(binaryBytes(PAGE)).toBe(false);
    expect(binaryBytes(new Uint8Array(400).fill(0xcf))).toBe(false);
    expect(binaryBytes(Buffer.from('﻿A page of text', 'utf16le'))).toBe(false);
  });

  test('compressed bytes are binary', () => {
    expect(binaryBytes(gzipSync(PAGE))).toBe(true);
    expect(binaryBytes(brotliCompressSync(PAGE))).toBe(true);
  });
});
