import { describe, expect, test } from 'vitest';

import { AI_CRAWLERS } from './ai-policy.ts';
import { robotsTxt, siteAddress, sitemapFiles } from './site-crawl.ts';

const SITE = 'https://gab.example.org/';
const LOCS = /<loc>([^<]*)<\/loc>/gu;
const locsOf = (xml: string | undefined): string[] =>
  [...(xml ?? '').matchAll(LOCS)].map((one) => one[1] ?? '');

describe('siteAddress', () => {
  test('takes the origin of iriBase and puts the folder of the host after it', () => {
    expect(siteAddress('https://gab.example.org/', '/')).toBe('https://gab.example.org/');
    expect(siteAddress('https://gab.example.org/old/', '/gab/')).toBe(
      'https://gab.example.org/gab/',
    );
  });

  test('gives null for an empty or a relative iriBase', () => {
    expect(siteAddress('', '/')).toBeNull();
    expect(siteAddress('/entity/', '/')).toBeNull();
    expect(siteAddress('ftp://gab.example.org/', '/')).toBeNull();
  });
});

describe('sitemapFiles', () => {
  const addresses = Array.from({ length: 7 }, (_, one) => `${SITE}entity/e${String(one)}/`);

  test('gives one file that holds each address once, with the day of the release', () => {
    const files = sitemapFiles(addresses, '2026-11-08', SITE);
    expect([...files.keys()]).toStrictEqual(['sitemap.xml']);
    const xml = files.get('sitemap.xml');
    expect(locsOf(xml)).toStrictEqual(addresses);
    expect(xml?.match(/<lastmod>2026-11-08<\/lastmod>/gu)).toHaveLength(7);
  });

  test('splits at the limit of addresses and writes an index', () => {
    const files = sitemapFiles(addresses, '2026-11-08', SITE, { addresses: 3, bytes: 1e9 });
    expect([...files.keys()].sort()).toStrictEqual([
      'sitemap-1.xml',
      'sitemap-2.xml',
      'sitemap-3.xml',
      'sitemap.xml',
    ]);
    expect(locsOf(files.get('sitemap.xml'))).toStrictEqual([
      `${SITE}sitemap-1.xml`,
      `${SITE}sitemap-2.xml`,
      `${SITE}sitemap-3.xml`,
    ]);
    const all = ['sitemap-1.xml', 'sitemap-2.xml', 'sitemap-3.xml'].flatMap((name) =>
      locsOf(files.get(name)),
    );
    expect(all).toStrictEqual(addresses);
    expect(locsOf(files.get('sitemap-1.xml'))).toHaveLength(3);
  });

  test('splits at the limit of bytes', () => {
    const files = sitemapFiles(addresses, '2026-11-08', SITE, { addresses: 1000, bytes: 400 });
    expect(files.size).toBeGreaterThan(2);
    // The addresses are ASCII, so the length of the text is its size in bytes.
    for (const [name, text] of files)
      if (name !== 'sitemap.xml') expect(text.length).toBeLessThanOrEqual(400);
  });

  test('escapes the characters of XML in an address', () => {
    const xml = sitemapFiles([`${SITE}a?b=1&c=2`], '2026-11-08', SITE).get('sitemap.xml');
    expect(xml).toContain('a?b=1&amp;c=2');
  });
});

describe('robotsTxt', () => {
  test('allows each page, names the sitemap and gives the AI policy', () => {
    const text = robotsTxt(SITE, 'allow');
    expect(text).toContain('User-agent: *\nAllow: /');
    expect(text).not.toContain('Disallow');
    expect(text).toContain(`Sitemap: ${SITE}sitemap.xml`);
    for (const name of AI_CRAWLERS) expect(text).toContain(`User-agent: ${name}\nAllow: /`);
  });

  test('disallows the AI crawlers only when the policy says so', () => {
    const text = robotsTxt(SITE, 'disallow');
    expect(text).toContain('User-agent: *\nAllow: /');
    for (const name of AI_CRAWLERS) expect(text).toContain(`User-agent: ${name}\nDisallow: /`);
  });

  test('names no sitemap when the site has no absolute address', () => {
    expect(robotsTxt(null, 'allow')).not.toContain('Sitemap');
  });
});
