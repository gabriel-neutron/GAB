// The edge worker of the public host. The host serves the build as static files and answers every
// unknown address with the shell of the application, so an agent finds no robots.txt, no sitemap
// and no markdown, and a wrong address answers 200. This worker serves what the files lack:
// the files for crawlers, markdown for the agents, the Link headers, the data of the page head
// and a true 404. It adds no state and no data: the facts come from the manifest of the release.

import { AI_CRAWLERS } from '@gab/release/ai-policy';
import { MAIN_PAGES } from '@gab/release/llms-txt';
import { robotsTxt, sitemapFiles } from '@gab/release/site-crawl';

import {
  APP_SEGMENTS,
  appMarkdown,
  dataLlms,
  homeMarkdown,
  LICENCE_URL,
  llmsIndex,
  openApi,
  REPOSITORY_URL,
  reportLlms,
  SKILLS,
  STATIC_PAGES,
  type Release,
} from './pages.ts';

interface Env {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
}

const FALLBACK_CONTACT = `${REPOSITORY_URL}/issues`;
const SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
const AI_AGENT = new RegExp(AI_CRAWLERS.join('|'), 'iu');

const text = (body: string, type: string): Response =>
  new Response(body, { headers: { 'content-type': `${type}; charset=utf-8`, vary: 'Accept' } });
const markdown = (body: string): Response => text(body, 'text/markdown');
const json = (value: unknown, type = 'application/json'): Response =>
  text(JSON.stringify(value, null, 2), type);

const readRelease = async (env: Env, origin: string): Promise<Release> => {
  try {
    const response = await env.ASSETS.fetch(new Request(`${origin}/release/manifest.json`));
    const manifest = (await response.json()) as {
      version: string;
      date: string;
      contacts: { reportError: string };
      files: { path: string }[];
    };
    return {
      version: manifest.version,
      date: manifest.date,
      contact: manifest.contacts.reportError,
      files: manifest.files.map((file) => file.path),
    };
  } catch {
    // The page still works with no manifest: the contact is then the public issue list.
    return {
      version: 'unknown',
      date: new Date().toISOString().slice(0, 10),
      contact: FALLBACK_CONTACT,
      files: [],
    };
  }
};

const sha256 = async (body: string): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const inline = (value: string): string =>
  escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/gu, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/gu, '<code>$1</code>');

/** The few markdown forms that the pages use: headings, lists, tables, code blocks, paragraphs. */
export const toHtml = (source: string): string => {
  const out: string[] = [];
  let list = false;
  let code = false;
  const close = (): void => {
    if (list) out.push('</ul>');
    list = false;
  };
  for (const line of source.split('\n')) {
    if (line.startsWith('```')) {
      close();
      out.push(code ? '</pre>' : '<pre>');
      code = !code;
    } else if (code) out.push(escapeHtml(line));
    else if (/^#{1,3} /u.test(line)) {
      close();
      const level = line.indexOf(' ');
      out.push(`<h${String(level)}>${inline(line.slice(level + 1))}</h${String(level)}>`);
    } else if (/^(- |\d+\. )/u.test(line)) {
      if (!list) out.push('<ul>');
      list = true;
      out.push(`<li>${inline(line.replace(/^(- |\d+\. )/u, ''))}</li>`);
    } else if (line.startsWith('|')) {
      if (!/^\|[\s|-]+\|$/u.test(line)) {
        close();
        const cells = line
          .slice(1, -1)
          .split('|')
          .map((cell) => `<td>${inline(cell.trim())}</td>`);
        out.push(`<table><tr>${cells.join('')}</tr></table>`);
      }
    } else if (line.startsWith('> ')) {
      close();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else if (line.trim() !== '') {
      close();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  return out.join('\n');
};

const STYLE =
  'body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;background:#101010;color:#eee}' +
  'a{color:#9cf}@media(prefers-color-scheme:light){body{background:#eee;color:#111}a{color:#06c}}' +
  'pre,code{font-family:ui-monospace,monospace}pre{overflow:auto}';

const staticPage = (
  site: string,
  slug: string,
  title: string,
  description: string,
  md: string,
): Response =>
  new Response(
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapeHtml(title)} · GAB dataset</title><meta name="description" content="${escapeHtml(description)}">` +
      `<link rel="canonical" href="${site}${slug}"><link rel="alternate" type="text/markdown" href="${site}${slug}.md">` +
      `<meta property="og:type" content="website"><meta property="og:image" content="${site}og-image.png">` +
      `<style>${STYLE}</style></head><body><nav><a href="${site}">GAB dataset</a></nav><main>${toHtml(md)}</main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', vary: 'Accept' } },
  );

const LINKS = (site: string): string =>
  [
    `<${site}sitemap.xml>; rel="sitemap"`,
    `<${site}llms.txt>; rel="describedby"; type="text/plain"`,
    `<${site}index.md>; rel="alternate"; type="text/markdown"`,
    `<${site}.well-known/api-catalog>; rel="api-catalog"`,
    `<${site}openapi.json>; rel="service-desc"; type="application/openapi+json"`,
    `<${site}docs>; rel="service-doc"`,
  ].join(', ');

const pageAddresses = (site: string): string[] => [
  ...MAIN_PAGES.map(([folder]) => (folder === '' ? site : `${site}${folder}/`)),
  `${site}fr/`,
  ...Object.keys(STATIC_PAGES).map((one) => `${site}${one}`),
];

/** The response for a generated address, or null when the address is a file or an application page. */
const generated = async (
  path: string,
  site: string,
  env: Env,
  origin: string,
): Promise<Response | null> => {
  const r = async (): Promise<Release> => readRelease(env, origin);
  const slug = path.replace(/^\//u, '').replace(/\/$/u, '');
  switch (slug) {
    case 'robots.txt':
      return text(robotsTxt(site), 'text/plain');
    case 'sitemap.xml': {
      const release = await r();
      return text(
        sitemapFiles(pageAddresses(site), release.date, site).get('sitemap.xml') ?? '',
        'application/xml',
      );
    }
    case 'llms.txt':
      return text(llmsIndex(site, await r()), 'text/plain');
    case 'data/llms.txt':
      return text(dataLlms(site, await r()), 'text/plain');
    case 'report/llms.txt':
      return text(reportLlms(site), 'text/plain');
    case 'index.md':
    case 'llms.md':
      return markdown(homeMarkdown(site));
    case 'openapi.json':
      return json(openApi(site, await r()), 'application/openapi+json');
    case '.well-known/api-catalog':
      return json(
        {
          linkset: [
            {
              anchor: `${site}.well-known/api-catalog`,
              item: [{ href: `${site}release/manifest.json` }],
              'service-desc': [{ href: `${site}openapi.json`, type: 'application/openapi+json' }],
              'service-doc': [{ href: `${site}docs`, type: 'text/html' }],
            },
          ],
        },
        'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
      );
    case '.well-known/ai-catalog.json':
    case '.well-known/ard.json':
      return json({
        specVersion: '1.0',
        host: { displayName: 'GAB dataset', identifier: `did:web:${new URL(site).host}` },
        entries: [
          {
            identifier: `urn:air:${new URL(site).host}:dataset:gab`,
            displayName: 'GAB dataset',
            description: 'Entities, relations and claims with their sources.',
            type: 'application/ld+json',
            url: `${site}release/dataset.jsonld`,
          },
          {
            identifier: `urn:air:${new URL(site).host}:api:files`,
            displayName: 'Open files of the release (OpenAPI)',
            type: 'application/openapi+json',
            url: `${site}openapi.json`,
          },
          {
            identifier: `urn:air:${new URL(site).host}:skills:gab`,
            displayName: 'Agent skills',
            type: 'application/json',
            url: `${site}.well-known/agent-skills/index.json`,
          },
        ],
      });
    case '.well-known/agent-skills/index.json':
      return json({
        $schema: SCHEMA,
        skills: await Promise.all(
          Object.entries(SKILLS).map(async ([name, skill]) => ({
            name,
            type: 'skill-md',
            description: skill.description,
            url: `${site}.well-known/agent-skills/${name}/SKILL.md`,
            digest: `sha256:${await sha256(skillFile(name, site))}`,
          })),
        ),
      });
    default:
  }
  const skill = /^\.well-known\/agent-skills\/([\w-]+)\/SKILL\.md$/u.exec(slug)?.[1];
  if (skill !== undefined && skill in SKILLS) return markdown(skillFile(skill, site));
  const wanted = slug.replace(/\.md$/u, '');
  const page = STATIC_PAGES[wanted];
  if (page === undefined) return null;
  const body = page.markdown(site, await r());
  return slug.endsWith('.md')
    ? markdown(body)
    : staticPage(site, wanted, page.title, page.description, body);
};

const skillFile = (name: string, site: string): string => {
  const skill = SKILLS[name];
  if (skill === undefined) return '';
  return `---\nname: ${name}\ndescription: ${skill.description}\n---\n\n${skill.body(site)}\n`;
};

/** True when a reader that sends this request wants markdown, by header or as a known AI agent. */
const wantsMarkdown = (request: Request): boolean => {
  const accept = request.headers.get('accept') ?? '';
  const markdownRank = accept
    .split(',')
    .findIndex((part) => part.trim().startsWith('text/markdown'));
  const htmlRank = accept.split(',').findIndex((part) => /^(text\/html|\*\/\*)/u.test(part.trim()));
  if (markdownRank !== -1 && (htmlRank === -1 || markdownRank < htmlRank)) return true;
  return AI_AGENT.test(request.headers.get('user-agent') ?? '');
};

const isAppPath = (path: string): boolean => {
  if (path === '/') return true;
  const [first] = path.replace(/^\//u, '').split('/');
  return first !== undefined && APP_SEGMENTS.includes(first);
};

const notFound = (request: Request, path: string): Response => {
  const hint = 'Start at /llms.txt for the pages and the files of the site.';
  const accept = request.headers.get('accept') ?? '';
  const body = accept.includes('application/json')
    ? JSON.stringify({ error: `No page or file at ${path}.`, hint })
    : `# 404: not found\n\nNo page or file exists at \`${path}\`. ${hint}\n\n[Markdown home page](/index.md)\n`;
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': accept.includes('application/json')
        ? 'application/json'
        : 'text/markdown; charset=utf-8',
      vary: 'Accept',
    },
  });
};

const HOME_TERMS =
  'GAB dataset, OSINT, investigation graph, sanctions, Russia, oil, shipping, vessels, open data';

const structuredData = (site: string, r: Release): string =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${site}#site`,
        name: 'GAB dataset',
        url: site,
        description: 'An open investigation graph in which every claim carries its source.',
        inLanguage: ['en', 'fr'],
      },
      {
        '@type': 'Organization',
        '@id': `${site}#org`,
        name: 'Gabriel',
        url: site,
        logo: `${site}icon-512.png`,
        sameAs: [REPOSITORY_URL, 'https://github.com/gabriel-neutron'],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'error reports and right of reply',
          email: r.contact.replace(/^mailto:/u, ''),
          url: `${site}contact`,
        },
      },
      {
        '@type': 'Dataset',
        '@id': `${site}#dataset`,
        name: 'GAB dataset',
        description:
          'Entities, relations and claims, each with a label that tells who decided it and the documents that state it.',
        url: site,
        version: r.version,
        dateModified: r.date,
        license: LICENCE_URL,
        isAccessibleForFree: true,
        keywords: HOME_TERMS.split(', '),
        creator: { '@id': `${site}#org` },
        distribution: r.files.map((file) => ({
          '@type': 'DataDownload',
          contentUrl: `${site}release/${file}`,
          name: file,
        })),
      },
      {
        '@type': 'SoftwareSourceCode',
        name: 'Gabriel',
        codeRepository: REPOSITORY_URL,
        license: 'https://opensource.org/licenses/MIT',
        programmingLanguage: 'TypeScript',
      },
    ],
  }).replaceAll('<', '\\u003c');

/** The head tags and the text for a reader with no script. The root stays empty, because the
 * application hydrates a root that holds text and an extra text would break the hydration. */
const decorate = (html: string, site: string, path: string, r: Release): string => {
  const home = path === '/';
  const twin = home ? 'index.md' : `${path.replace(/^\//u, '').replace(/\/$/u, '')}.md`;
  const head = [
    `<link rel="canonical" href="${site}${home ? '' : path.replace(/^\//u, '')}">`,
    `<link rel="alternate" type="text/markdown" href="${site}${twin}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="GAB dataset">',
    `<meta property="og:image" content="${site}og-image.png">`,
    '<meta name="twitter:card" content="summary_large_image">',
    ...(home
      ? [
          '<meta name="description" content="An open investigation graph in which every claim carries its source: entities, relations and claims about sanctions, trade and shipping, with the documents that state them.">',
          `<meta name="keywords" content="${HOME_TERMS}">`,
          `<script type="application/ld+json">${structuredData(site, r)}</script>`,
        ]
      : []),
  ].join('');
  const fallback = home
    ? `<noscript><main><h1>GAB dataset</h1>${toHtml(homeMarkdown(site))}<p>Gabriel is an open-source investigation graph. The pages above need a script. The files of the release are plain files: see <a href="${site}docs">the documentation</a>.</p></main></noscript>`
    : '';
  return html
    .replace('</head>', `${head}</head>`)
    .replace('<div id="root"></div>', `<div id="root"></div>${fallback}`);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const site = `${url.origin}/`;
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);

    const made = await generated(url.pathname, site, env, url.origin);
    if (made !== null) {
      made.headers.set('link', LINKS(site));
      return made;
    }

    const response = await env.ASSETS.fetch(request);
    const type = response.headers.get('content-type') ?? '';
    // A file with a name returns itself. An address that is no file and no page returns the shell
    // of the application, which the worker turns into a true 404.
    if (!type.includes('text/html')) return response;
    if (!isAppPath(url.pathname)) return notFound(request, url.pathname);

    if (wantsMarkdown(request)) {
      const folder = url.pathname.replace(/^\//u, '').replace(/\/$/u, '');
      return markdown(
        folder === '' ? homeMarkdown(site) : appMarkdown(site, folder.split('/')[0] ?? folder),
      );
    }
    const headers = new Headers(response.headers);
    headers.set('link', LINKS(site));
    headers.append('vary', 'Accept');
    const html = decorate(
      await response.text(),
      site,
      url.pathname,
      await readRelease(env, url.origin),
    );
    headers.delete('content-length');
    return new Response(html, { status: response.status, headers });
  },
};
