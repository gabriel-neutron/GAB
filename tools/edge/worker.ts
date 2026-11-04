// The edge worker of the public host. The host serves the build as static files and answers every
// unknown address with the shell of the application, so an agent finds no robots.txt, no sitemap
// and no markdown, and a wrong address answers 200. This worker serves what the files lack:
// the files for crawlers, markdown for the agents, the Link headers, the data of the page head
// and a true 404. It adds no state and no data: the facts come from the manifest of the release.

import { z } from 'zod';

import { AI_CRAWLERS } from '@gab/release/ai-policy';
import { MAIN_PAGES } from '@gab/release/llms-txt';
import { robotsTxt, sitemapFiles } from '@gab/release/site-crawl';

import { handle as handleMcp, serverCard } from './mcp.ts';

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
  /** The rate limiter of the host (`wrangler.jsonc`). A run with no binding, as a test, has none. */
  readonly RATE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

const FALLBACK_CONTACT = `${REPOSITORY_URL}/issues`;
const SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
const AI_AGENT = new RegExp(AI_CRAWLERS.join('|'), 'iu');

const text = (body: string, type: string): Response =>
  new Response(body, { headers: { 'content-type': `${type}; charset=utf-8`, vary: 'Accept' } });
/** Markdown. With `meta`, a front matter block gives agents the title, the description, the
 * canonical address and the date of the release. */
const markdown = (body: string, meta?: { canonical: string; date: string }): Response => {
  if (meta === undefined) return text(body, 'text/markdown');
  const title = /^# (.+)$/mu.exec(body)?.[1] ?? 'GAB dataset';
  const first = body.split('\n').find((line) => line !== '' && !line.startsWith('#')) ?? title;
  const description = first.replace(/^> /u, '').replaceAll('"', "'");
  const front = `---\ntitle: "${title.replaceAll('"', "'")}"\ndescription: "${description}"\ncanonical: ${meta.canonical}\nlast-updated: ${meta.date}\n---\n\n`;
  return text(front + body, 'text/markdown');
};
const json = (value: unknown, type = 'application/json'): Response =>
  text(JSON.stringify(value, null, 2), type);

// The worker reads only these members of the manifest. The contact must be a mail or a web address,
// because it goes into a link. A path goes into a link too, so it takes the rule of the release
// writer: a plain file name.
const manifestShape = z.object({
  version: z.string(),
  date: z.string(),
  contacts: z.object({ reportError: z.string().regex(/^(mailto:|https:\/\/)\S+$/u) }),
  files: z.array(z.object({ path: z.string().regex(/^[\w-][\w.-]*$/u) })),
});

const readRelease = async (env: Env, origin: string): Promise<Release> => {
  try {
    const response = await env.ASSETS.fetch(new Request(`${origin}/release/manifest.json`));
    const manifest = manifestShape.parse(await response.json());
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
      return markdown(homeMarkdown(site), { canonical: site, date: (await r()).date });
    case 'openapi.json':
      return json(openApi(site, await r()), 'application/openapi+json');
    case '.well-known/mcp/server-card.json':
      return json(serverCard(site, await r()));
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
            identifier: `urn:air:${new URL(site).host}:mcp:gab`,
            displayName: 'GAB dataset MCP server (read only)',
            type: 'application/mcp-server-card+json',
            url: `${site}.well-known/mcp/server-card.json`,
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
  if (skill !== undefined && Object.hasOwn(SKILLS, skill)) return markdown(skillFile(skill, site));
  const wanted = slug.replace(/\.md$/u, '');
  if (slug.endsWith('.md') && wanted !== '' && isAppPath(`/${wanted}`))
    return markdown(appMarkdown(site, wanted.split('/')[0] ?? wanted), {
      canonical: `${site}${wanted}/`,
      date: (await r()).date,
    });
  const page = Object.hasOwn(STATIC_PAGES, wanted) ? STATIC_PAGES[wanted] : undefined;
  if (page === undefined) return null;
  const release = await r();
  const body = page.markdown(site, release);
  // The spec of auth.md starts the file with its title, so that one file has no front matter.
  if (slug === 'auth.md') return markdown(body);
  return slug.endsWith('.md')
    ? markdown(body, { canonical: `${site}${wanted}`, date: release.date })
    : staticPage(site, wanted, page.title, page.description, body);
};

const skillFile = (name: string, site: string): string => {
  const skill = Object.hasOwn(SKILLS, name) ? SKILLS[name] : undefined;
  if (skill === undefined) return '';
  return `---\nname: ${name}\ndescription: ${skill.description}\n---\n\n${skill.body(site)}\n`;
};

/** True when a reader that sends this request wants markdown, by header or as a known AI agent. */
const wantsMarkdown = (request: Request, shell: boolean): boolean => {
  const accept = request.headers.get('accept') ?? '';
  const markdownRank = accept
    .split(',')
    .findIndex((part) => part.trim().startsWith('text/markdown'));
  const htmlRank = accept.split(',').findIndex((part) => /^(text\/html|\*\/\*)/u.test(part.trim()));
  if (markdownRank !== -1 && (htmlRank === -1 || markdownRank < htmlRank)) return true;
  // A known AI crawler gets markdown only for a page with no text of its own: a prerendered page
  // already holds its text for the crawler.
  return shell && AI_AGENT.test(request.headers.get('user-agent') ?? '');
};

const isAppPath = (path: string): boolean => {
  if (path === '/') return true;
  const [first] = path.replace(/^\//u, '').split('/');
  return first !== undefined && APP_SEGMENTS.includes(first);
};

const notFound = (request: Request, path: string): Response => {
  const hint = 'Start at /llms.txt for the pages and the files of the site.';
  const accept = request.headers.get('accept') ?? '';
  // A request for a file (a name with an extension) or for JSON gets the JSON body that docs.md
  // promises. Every other request gets markdown.
  const asJson =
    accept.includes('application/json') || /\.\w+$/u.test(path) || path.startsWith('/api/');
  const shown = path.replace(/[`\s]/gu, '');
  const body = asJson
    ? JSON.stringify({ error: `No page or file at ${shown}.`, code: 'not_found', hint })
    : `# 404: not found\n\nNo page or file exists at \`${shown}\`. ${hint}\n\n[Markdown home page](/index.md)\n`;
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': asJson ? 'application/json' : 'text/markdown; charset=utf-8',
      vary: 'Accept',
      'x-content-type-options': 'nosniff',
    },
  });
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, mcp-protocol-version',
  'x-content-type-options': 'nosniff',
} as const;

/** A JSON error with the one shape of the open interfaces: `error`, `code` and `hint`. */
const failure = (status: number, code: string, error: string, hint: string): Response =>
  new Response(JSON.stringify({ error, code, hint }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });

const MAX_BODY = 64 * 1024;

const filesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
  cursor: z.string().regex(/^\d+$/u).default('0'),
});

/** The addresses that read the request: the MCP server and the versioned file list. Null for any
 * other address. */
const dynamic = async (
  request: Request,
  url: URL,
  env: Env,
  site: string,
): Promise<Response | null> => {
  const isMcp = url.pathname === '/mcp';
  const isFiles = url.pathname === '/api/v1/files';
  if (!isMcp && !isFiles) return null;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  // The interface is open and holds no key. A limit for each address keeps one client from
  // using all of it. The limit is generous, because an agent pages through the list.
  const allowed = await env.RATE_LIMIT?.limit({
    key: request.headers.get('cf-connecting-ip') ?? 'unknown',
  });
  if (allowed?.success === false) {
    const limited = failure(
      429,
      'rate_limited',
      'Too many requests.',
      'Wait one minute and send the request again. The release files are plain downloads with no limit.',
    );
    limited.headers.set('retry-after', '60');
    return limited;
  }
  const release = await readRelease(env, url.origin);
  // A manifest that cannot be read must not look like an empty release.
  if (release.files.length === 0)
    return failure(
      503,
      'release_unavailable',
      'The manifest of the release cannot be read.',
      'Try again later, or fetch /release/manifest.json.',
    );

  if (isFiles) {
    if (request.method !== 'GET')
      return failure(405, 'method_not_allowed', 'Use GET.', 'This address only reads.');
    const query = filesQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!query.success)
      return failure(
        400,
        'invalid_parameter',
        'The parameter limit or cursor is not valid.',
        'limit is an integer from 1 to 50. cursor is the value of next in the previous reply.',
      );
    const from = Number(query.data.cursor);
    const next = from + query.data.limit;
    return new Response(
      JSON.stringify({
        data: release.files
          .slice(from, next)
          .map((file) => ({ file, url: `${site}release/${file}` })),
        total: release.files.length,
        next: next < release.files.length ? String(next) : null,
      }),
      { headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } },
    );
  }

  if (request.method !== 'POST')
    return failure(
      405,
      'method_not_allowed',
      'Use POST with a JSON-RPC message.',
      `The server card is at ${site}.well-known/mcp/server-card.json.`,
    );
  // A message of this server is a few hundred bytes, so a large body is refused before it is read.
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY)
    return failure(
      413,
      'too_large',
      'The body is too large.',
      `Send at most ${String(MAX_BODY)} bytes.`,
    );
  const raw = await request.text();
  if (raw.length > MAX_BODY)
    return failure(
      413,
      'too_large',
      'The body is too large.',
      `Send at most ${String(MAX_BODY)} bytes.`,
    );
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error.' },
      }),
      { headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } },
    );
  }
  const answer = handleMcp(message, { site, release });
  if (answer === null) return new Response(null, { status: 202, headers: CORS });
  return new Response(JSON.stringify(answer), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
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
        description:
          'An open-source investigation graph project that publishes the GAB dataset: sourced claims about sanctions, trade and shipping.',
        logo: `${site}icon-512.png`,
        sameAs: [REPOSITORY_URL, 'https://github.com/gabriel-neutron'],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'error reports and right of reply',
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
        '@type': 'DataCatalog',
        '@id': `${site}#catalog`,
        name: 'GAB dataset files',
        url: `${site}release/manifest.json`,
        dataset: { '@id': `${site}#dataset` },
      },
      {
        '@type': 'WebAPI',
        '@id': `${site}#api`,
        name: 'GAB dataset open files interface',
        description:
          'Read-only list of the files of the release, and an MCP server. No key is needed.',
        url: `${site}api/v1/files`,
        documentation: `${site}docs`,
        provider: { '@id': `${site}#org` },
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
  // A page that the release build wrote holds its own head and its own text already.
  if (!html.includes('<div id="root"></div>') || html.includes('rel="canonical"')) return html;
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
  // Outside the root, so the hydration never sees it. Hidden, because the application draws the
  // same facts for a reader with a script.
  const body = home
    ? `<h1>GAB dataset</h1>${toHtml(homeMarkdown(site))}<p>Gabriel is an open-source investigation graph. The pages above need a script. The files of the release are plain files: see <a href="${site}docs">the documentation</a>.</p>`
    : toHtml(appMarkdown(site, path.replace(/^\//u, '').split('/')[0] ?? ''));
  const fallback = `<div id="static-content" hidden><main>${body}</main></div>`;
  return html
    .replace('</head>', `${head}</head>`)
    .replace('<div id="root"></div>', `<div id="root"></div>${fallback}`);
};

// The headers of every answer. No other site may frame a page, a file is never read as another
// type, and a link out sends the origin only. A full Content-Security-Policy waits: the inline theme
// script, the JSON-LD and the map need their own sources first.
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy': "frame-ancestors 'none'",
  'referrer-policy': 'strict-origin-when-cross-origin',
} as const;

/** Adds the security headers to an answer, and the noindex header of a staging build. The host
 * adds that header to its own files only, so the worker copies it to each answer it makes. */
const guarded = async (response: Response, env: Env, origin: string): Promise<Response> => {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(name)) out.headers.set(name, value);
  }
  if (!out.headers.has('x-robots-tag')) {
    const closed = await env.ASSETS.fetch(new Request(`${origin}/favicon.svg`));
    const robots = closed.headers.get('x-robots-tag');
    if (robots !== null) out.headers.set('x-robots-tag', robots);
  }
  return out;
};

const answer = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const site = `${url.origin}/`;
  const open = await dynamic(request, url, env, site);
  if (open !== null) return open;
  if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);

  const made = await generated(url.pathname, site, env, url.origin).catch(() => null);
  if (made !== null) {
    made.headers.set('link', LINKS(site));
    return request.method === 'HEAD' ? new Response(null, made) : made;
  }

  const response = await env.ASSETS.fetch(request);
  const type = response.headers.get('content-type') ?? '';
  // A file with a name returns itself. An address that is no file and no page returns the shell
  // of the application, which the worker turns into a true 404.
  if (!type.includes('text/html')) return response;
  if (!isAppPath(url.pathname)) return notFound(request, url.pathname);

  const html = await response.text();
  const shell = html.includes('<div id="root"></div>');
  if (url.pathname === '/' && url.searchParams.get('mode') === 'agent') {
    return json({
      name: 'GAB dataset',
      description: 'Sourced claims about sanctions, trade and shipping, as open files.',
      authentication: 'none',
      endpoints: {
        manifest: `${site}release/manifest.json`,
        openapi: `${site}openapi.json`,
        llms: `${site}llms.txt`,
        skills: `${site}.well-known/agent-skills/index.json`,
      },
      licence: LICENCE_URL,
    });
  }
  if (wantsMarkdown(request, shell)) {
    const folder = url.pathname.replace(/^\//u, '').replace(/\/$/u, '');
    return markdown(
      folder === '' ? homeMarkdown(site) : appMarkdown(site, folder.split('/')[0] ?? folder),
      {
        canonical: `${site}${folder === '' ? '' : `${folder}/`}`,
        date: (await readRelease(env, url.origin)).date,
      },
    );
  }
  const headers = new Headers(response.headers);
  headers.set('link', LINKS(site));
  headers.append('vary', 'Accept');
  headers.delete('content-length');
  headers.delete('etag');
  // Only the home page uses the data of the release, so the other pages skip the extra read.
  const release =
    shell && url.pathname === '/'
      ? await readRelease(env, url.origin)
      : { version: '', date: '', contact: FALLBACK_CONTACT, files: [] };
  const out = decorate(html, site, url.pathname, release);
  return new Response(request.method === 'HEAD' ? null : out, {
    status: response.status,
    headers,
  });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return guarded(await answer(request, env), env, new URL(request.url).origin);
  },
};
