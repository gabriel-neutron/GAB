import { AI_CRAWLER_POLICY, AI_CRAWLERS, type AiPolicy } from './ai-policy.ts';

/** The limits of the standard sitemap for one file. */
export interface SitemapLimits {
  readonly addresses: number;
  readonly bytes: number;
}

export const SITEMAP_LIMITS: SitemapLimits = { addresses: 50_000, bytes: 50 * 1024 * 1024 };

/** The public address of the site: the origin of `iriBase`, then the folder of the host where the
 * site stands (`SITE_BASE`). It ends with a slash. Null when the release has no usable `iriBase`. */
export const siteAddress = (iriBase: string, base: string): string | null => {
  const origin = /^https?:\/\/[^\s/?#@]+/u.exec(iriBase)?.[0];
  return origin === undefined ? null : `${origin}${base}`;
};

const escapeXml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const URLSET = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n';
const INDEX =
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</sitemapindex>\n';

// The length of the text in UTF-8, which is the size of the file. This package has no encoder.
const bytesOf = (text: string): number => {
  let total = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    total += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return total;
};

const entry = (address: string, lastmod: string): string =>
  `<url><loc>${escapeXml(address)}</loc><lastmod>${lastmod}</lastmod></url>\n`;

/** The files of the sitemap, by file name. A list that fits in one file gives `sitemap.xml`. A
 * longer list gives `sitemap-1.xml`, `sitemap-2.xml` and so on, and `sitemap.xml` is their index.
 * `lastmod` is the day of the release. */
export const sitemapFiles = (
  addresses: readonly string[],
  lastmod: string,
  site: string,
  limits: SitemapLimits = SITEMAP_LIMITS,
): ReadonlyMap<string, string> => {
  const fixed = bytesOf(HEAD + URLSET);
  const groups: string[][] = [[]];
  let size = fixed;
  for (const address of addresses) {
    const cost = bytesOf(entry(address, lastmod));
    const group = groups[groups.length - 1] ?? [];
    if (group.length > 0 && (group.length >= limits.addresses || size + cost > limits.bytes)) {
      groups.push([address]);
      size = fixed + cost;
    } else {
      group.push(address);
      size += cost;
    }
  }
  const file = (group: readonly string[]): string =>
    `${HEAD}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${group
      .map((one) => entry(one, lastmod))
      .join('')}</urlset>\n`;
  const [only] = groups;
  if (groups.length === 1 && only !== undefined) return new Map([['sitemap.xml', file(only)]]);
  const files = new Map<string, string>();
  const names = groups.map((_group, index) => `sitemap-${String(index + 1)}.xml`);
  groups.forEach((group, index) => {
    files.set(names[index] ?? '', file(group));
  });
  const index = names
    .map(
      (name) =>
        `<sitemap><loc>${escapeXml(site + name)}</loc><lastmod>${lastmod}</lastmod></sitemap>\n`,
    )
    .join('');
  files.set(
    'sitemap.xml',
    `${HEAD}${INDEX.replace('</sitemapindex>\n', `${index}</sitemapindex>\n`)}`,
  );
  return files;
};

/** The `robots.txt` of the site. It allows each page and each file. It names the AI crawlers with
 * the policy of the operator, and it points to the sitemap when the site has one. */
export const robotsTxt = (site: string | null, policy: AiPolicy = AI_CRAWLER_POLICY): string => {
  const rule = policy === 'allow' ? 'Allow: /' : 'Disallow: /';
  const lines = [
    '# Each page and each file of the release is public.',
    'User-agent: *',
    'Allow: /',
    '',
    policy === 'allow'
      ? '# Policy for AI systems: reading is allowed. Cite the claim that you use (see the page "AI use").'
      : '# Policy for AI systems: reading by the known AI crawlers is not allowed.',
    ...AI_CRAWLERS.flatMap((name) => [`User-agent: ${name}`, rule, '']),
  ];
  if (site !== null) lines.push(`Sitemap: ${site}sitemap.xml`, '');
  return lines.join('\n');
};
