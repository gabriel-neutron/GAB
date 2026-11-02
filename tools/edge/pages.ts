// The text that the edge worker serves for readers that are not browsers: the files for crawlers,
// the markdown twin of each page and the pages that carry the trust anchors (about, contact,
// privacy). Each function takes the address of the site, which ends with a slash, so a preview
// host and the public host both give correct addresses.

import { AI_CRAWLER_POLICY } from '@gab/release/ai-policy';
import { MAIN_PAGES } from '@gab/release/llms-txt';

export const LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const REPOSITORY_URL = 'https://github.com/gabriel-neutron/GAB';

/** The data that the worker reads from the manifest of the release at the time of the request. */
export interface Release {
  readonly version: string;
  readonly date: string;
  readonly contact: string;
  readonly files: readonly string[];
}

/** The first segment of each page that the application draws. A test compares this list with the
 * files under `src/routes/`. */
export const APP_SEGMENTS: readonly string[] = [
  'ai-use',
  'atlas',
  'bibliography',
  'claim',
  'downloads',
  'entity',
  'exports',
  'fr',
  'glossary',
  'graph',
  'help',
  'map',
  'method',
  'nodes',
  'relation',
  'report-figure',
  'review',
  'search',
  'vessel',
];

const at = (site: string, folder: string): string => `${site}${folder}`;

const SUMMARY =
  'Gabriel is an open-source investigation graph in which every claim carries its source. ' +
  'The GAB dataset is the public release of that graph: entities (people, companies, vessels, ' +
  'places), the relations between them and the claims that state them, each with a label that ' +
  'tells who decided it and the documents that state it.';

/** The pages that are not in the application, with the markdown of each. */
export const STATIC_PAGES: Readonly<
  Record<
    string,
    { title: string; description: string; markdown: (site: string, r: Release) => string }
  >
> = {
  about: {
    title: 'About',
    description: 'What the GAB dataset is, who makes it and how to read a claim.',
    markdown: (site) =>
      [
        '# About the GAB dataset',
        '',
        SUMMARY,
        '',
        'The project has two layers. An AI agent reads public documents and writes only proposals. A proposal becomes evidence only when a named rule accepts it or when the analyst decides it. The label on each claim tells which of the two happened.',
        '',
        '## What the data covers',
        '',
        'The release holds sanctions, trade, shipping and ownership facts about the Russian economy and the nodes that sustain it. A claim tells what its sources say. It is not proof. Keep the label of a claim when you copy it.',
        '',
        '## Where to read more',
        '',
        `- [Method](${at(site, 'method/')}): the evidence standard, the labels and the limits.`,
        `- [AI use](${at(site, 'ai-use/')}): the licence and how to cite a claim.`,
        `- [Source code](${REPOSITORY_URL}): the application and the tools, under the MIT licence.`,
        `- [Contact](${at(site, 'contact')}): how to report an error or to ask for a reply.`,
      ].join('\n'),
  },
  contact: {
    title: 'Contact',
    description: 'How to report an error in the GAB dataset or to use the right of reply.',
    markdown: (_site, r) =>
      [
        '# Contact',
        '',
        'Every claim in the GAB dataset can be wrong, and the project wants to know. Tell the maintainer when a claim is wrong, when a source does not say what a claim says, or when a person or a company named in the data wants to reply.',
        '',
        '## Report an error or use the right of reply',
        '',
        `- Write to [${r.contact.replace(/^mailto:/u, '')}](${r.contact}). Name the page or the claim identifier and say what is wrong.`,
        `- Or open an issue on [GitHub](${REPOSITORY_URL}/issues). An issue is public, so do not put private data in it.`,
        '',
        'The maintainer reads each message. A party that the report names has the right to reply, and the project keeps each reply with the claim it concerns. A confirmed error is corrected in the next release, and the changelog of the release lists the change.',
      ].join('\n'),
  },
  privacy: {
    title: 'Privacy',
    description:
      'What the GAB site stores about a reader: nothing, except the theme in the browser.',
    markdown: () =>
      [
        '# Privacy',
        '',
        'The GAB site is a static site. It has no account, no form that collects data about a reader, no advertisement and no analytics script. The site sets no cookie.',
        '',
        '## What the browser stores',
        '',
        'The application keeps the theme that you choose (dark, light or system) in the local storage of your browser. That value stays on your device and the site never sends it anywhere. Delete it from the settings of your browser at any time.',
        '',
        '## What the host logs',
        '',
        'The host of the site, Cloudflare, handles each request and keeps the usual technical logs of a web server (address, time and page). The project does not read them to follow a person.',
        '',
        '## People named in the data',
        '',
        'The dataset names people and companies that appear in public documents. If you are named and the data is wrong, use the right of reply on the contact page.',
      ].join('\n'),
  },
  docs: {
    title: 'Documentation',
    description:
      'Documentation of the open files of the GAB dataset: the files, their columns and how to read them.',
    markdown: (site, r) =>
      [
        '# GAB dataset documentation',
        '',
        'The GAB dataset has no server API. It is a release: a dated folder of open files that any client reads with a plain GET request. No key, no sign-in and no rate plan is needed.',
        '',
        '## Entry points',
        '',
        `- Manifest: \`GET ${at(site, 'release/manifest.json')}\` lists every file with its size and its SHA-256 checksum, the version (${r.version}) and the contacts.`,
        `- Linked data: \`GET ${at(site, 'release/dataset.jsonld')}\` is a schema.org Dataset record.`,
        `- OpenAPI description: \`GET ${at(site, 'openapi.json')}\` describes these requests for tools.`,
        '',
        '## Files of this release',
        '',
        ...r.files.map((file) => `- \`GET ${at(site, `release/${file}`)}\``),
        '',
        '## Errors',
        '',
        'A missing file answers with the status 404 and a JSON body with the members `error` and `hint`.',
        '',
        '## Licence',
        '',
        `The data is under [CC-BY 4.0](${LICENCE_URL}). Cite the dataset and keep the label of each claim.`,
      ].join('\n'),
  },
  developers: {
    title: 'Developers',
    description: 'How to use the GAB dataset in code: no key, no sign-in, plain files.',
    markdown: (site) =>
      [
        '# Developers',
        '',
        'Use the GAB dataset like any open data set. There is nothing to register for and no key to request: every file is public and is served with a plain GET request.',
        '',
        '## Quick start',
        '',
        '1. Read the manifest to get the list of files and their checksums.',
        '2. Download the files that you need, for example the entities and the claims as CSV.',
        '3. Check the SHA-256 checksum of each file against the manifest.',
        '4. Cite the dataset and keep the label of each claim.',
        '',
        '```',
        `curl ${at(site, 'release/manifest.json')}`,
        '```',
        '',
        '## Links',
        '',
        `- [Documentation](${at(site, 'docs')}) and [OpenAPI description](${at(site, 'openapi.json')}).`,
        `- [Source code and issues](${REPOSITORY_URL}), under the MIT licence.`,
        `- [Agent skills](${at(site, '.well-known/agent-skills/index.json')}) for AI agents that use the data.`,
        '',
        '## Sandbox',
        '',
        'The public files are the same for everyone and a request cannot change them, so there is nothing to break and no separate test mode.',
      ].join('\n'),
  },
  pricing: {
    title: 'Pricing',
    description: 'The GAB dataset is free to read and to reuse under CC-BY 4.0.',
    markdown: () =>
      [
        '# Pricing',
        '',
        'The GAB dataset is free. There is no paid plan, no trial, no key and no limit set by the project.',
        '',
        '| Plan | Price | What you get |',
        '| --- | --- | --- |',
        '| Open | 0 EUR | Every page, every file of the release and the source code |',
        '',
        `The data is under [CC-BY 4.0](${LICENCE_URL}): you may copy and reuse it, including for a commercial use, if you cite it.`,
      ].join('\n'),
  },
  agents: {
    title: 'For AI agents',
    description: 'When an AI agent should use the GAB dataset, and how.',
    markdown: (site) =>
      [
        '# For AI agents',
        '',
        '## When to use this site',
        '',
        '- You need a sourced fact about sanctions, trade, shipping or ownership around the Russian economy, and you must cite the document that states it.',
        '- You need to know who decided a claim: a rule, an analyst or nobody yet.',
        '- You need a list of entities (vessels, companies, people, places) with their identifiers.',
        '',
        '## When not to use it',
        '',
        '- You need a live feed. A release is a dated snapshot.',
        '- You need proof. A claim tells what its sources say, and a claim marked as proposed was not checked.',
        '',
        '## How to call it',
        '',
        `1. Fetch [llms.txt](${at(site, 'llms.txt')}) for the map of the site.`,
        `2. Fetch [the manifest](${at(site, 'release/manifest.json')}) and then the CSV files that you need.`,
        '3. Ask for a page with `Accept: text/markdown` to get its markdown twin, or add `.md` to its address.',
        '4. Cite the claim with its permanent address and keep its label.',
        '',
        `No sign-in is needed. See [documentation](${at(site, 'docs')}).`,
      ].join('\n'),
  },
};

const pageList = (site: string): string =>
  MAIN_PAGES.map(
    ([folder, name, note]) =>
      `- [${name}](${at(site, folder === '' ? '' : `${folder}/`)}): ${note}`,
  ).join('\n');

/** The markdown of the home page. */
export const homeMarkdown = (site: string): string =>
  [
    '# GAB dataset',
    '',
    `> ${SUMMARY}`,
    '',
    'A claim tells what its sources say. It is not proof. The home page of the application is a report on the nodes that sustain the war, with maps, a graph and the open files of the release.',
    '',
    '## Pages',
    '',
    pageList(site),
    '',
    '## For readers and agents',
    '',
    `- [About](${at(site, 'about')}), [Contact](${at(site, 'contact')}), [Privacy](${at(site, 'privacy')}).`,
    `- [Documentation](${at(site, 'docs')}), [Developers](${at(site, 'developers')}), [For AI agents](${at(site, 'agents')}).`,
    `- [Source code](${REPOSITORY_URL}).`,
  ].join('\n');

/** The markdown of a page of the application. The pages need a script, so the twin holds the
 * purpose of the page and points to the files that hold the same facts. */
export const appMarkdown = (site: string, folder: string): string => {
  const known = MAIN_PAGES.find(([one]) => one === folder);
  const name = known?.[1] ?? folder;
  const note = known?.[2] ?? 'A page of the GAB dataset that needs a script to show its data.';
  return [
    `# ${name}`,
    '',
    note,
    '',
    `This page of the [GAB dataset](${site}) draws its data in the browser. The same facts are in the open files of the release: start with [the manifest](${at(site, 'release/manifest.json')}) or read [the documentation](${at(site, 'docs')}).`,
    '',
    `Back to the [markdown home page](${at(site, 'index.md')}).`,
  ].join('\n');
};

/** The file `llms.txt`: a navigation index with a section for the agents and a link to each
 * section file. */
export const llmsIndex = (site: string, r: Release): string =>
  [
    '# GAB dataset',
    '',
    `> ${SUMMARY} Release ${r.version}, ${r.date}.`,
    '',
    AI_CRAWLER_POLICY === 'allow'
      ? 'Reading is allowed. Cite the claim that you use.'
      : 'The operator does not allow the known AI crawlers to read this site.',
    '',
    '## When to use this site',
    '',
    '- Use it for a sourced fact about sanctions, trade, shipping or ownership around the Russian economy. Every claim lists the documents that state it.',
    '- Use it to learn who decided a claim: a rule, an analyst or nobody yet.',
    '- Do not use it as proof or as a live feed. A release is a dated snapshot.',
    '',
    '## Pages',
    '',
    pageList(site),
    '',
    '## Sections',
    '',
    `- [Data files](${at(site, 'data/llms.txt')}): the files of the release and their checksums.`,
    `- [Report](${at(site, 'report/llms.txt')}): the report and its figures.`,
    '',
    '## Documentation',
    '',
    `- [Markdown home page](${at(site, 'index.md')})`,
    `- [For AI agents](${at(site, 'agents.md')})`,
    `- [Documentation](${at(site, 'docs.md')}) and [OpenAPI description](${at(site, 'openapi.json')})`,
    `- [Developers](${at(site, 'developers.md')}) and [pricing](${at(site, 'pricing.md')})`,
    `- [About](${at(site, 'about.md')}), [contact](${at(site, 'contact.md')}) and [privacy](${at(site, 'privacy.md')})`,
    `- [Source code](${REPOSITORY_URL})`,
    '',
    '## How to cite',
    '',
    `- The dataset: GAB dataset, release ${r.version}, ${r.date}. ${site}`,
    `- A claim: its permanent address, ${site}claim/<identifier>/, and the sources that its page lists.`,
    '',
    '## Licence',
    '',
    `- The dataset is under [CC-BY 4.0](${LICENCE_URL}).`,
    '',
  ].join('\n');

/** The section file of the data. */
export const dataLlms = (site: string, r: Release): string =>
  [
    '# GAB dataset: data files',
    '',
    `> The open files of release ${r.version}. Each one is a plain GET request, and the manifest lists the SHA-256 checksum of each.`,
    '',
    '## Files',
    '',
    `- [manifest.json](${at(site, 'release/manifest.json')}): the list of files, the licence and the contacts`,
    ...r.files.map((file) => `- [${file}](${at(site, `release/${file}`)})`),
    '',
  ].join('\n');

/** The section file of the report. */
export const reportLlms = (site: string): string =>
  [
    '# GAB dataset: report',
    '',
    '> The report on the nodes that sustain the war, in English and in French, with a PDF of each.',
    '',
    '## Pages',
    '',
    `- [Report, English](${at(site, '')}): the home page`,
    `- [Report, French](${at(site, 'fr/')})`,
    `- [Bibliography](${at(site, 'bibliography/')})`,
    `- [Glossary](${at(site, 'glossary/')})`,
    '',
  ].join('\n');

/** The OpenAPI description of the open files, so a tool that reads OpenAPI can call them. */
export const openApi = (site: string, r: Release): object => ({
  openapi: '3.1.0',
  info: {
    title: 'GAB dataset open files',
    version: r.version,
    description:
      'Read-only access to the open files of the GAB dataset. The files are static, so every request is a plain GET with no key and no sign-in.',
    license: { name: 'CC-BY 4.0', url: LICENCE_URL },
  },
  servers: [{ url: site.replace(/\/$/u, '') }],
  paths: {
    '/release/manifest.json': {
      get: {
        operationId: 'getManifest',
        summary: 'Get the manifest of the release',
        description:
          'The version, the date, the contacts and the list of files with the size and the SHA-256 checksum of each.',
        responses: {
          '200': {
            description: 'The manifest.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/release/{file}': {
      get: {
        operationId: 'getReleaseFile',
        summary: 'Get one file of the release',
        description: 'One file named in the manifest, as CSV, GeoJSON, JSON-LD or Markdown.',
        parameters: [
          {
            name: 'file',
            in: 'path',
            required: true,
            description: 'The name of a file in the manifest, for example entities.csv.',
            schema: { type: 'string', enum: [...r.files] },
          },
        ],
        responses: {
          '200': { description: 'The file.', content: { '*/*': { schema: { type: 'string' } } } },
          '404': {
            description: 'No such file.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: 'object',
        required: ['error', 'hint'],
        properties: { error: { type: 'string' }, hint: { type: 'string' } },
      },
    },
  },
});

/** The skills that the site lists for agents. Each one is a `SKILL.md` file. */
export const SKILLS: Readonly<
  Record<string, { description: string; body: (site: string) => string }>
> = {
  'gab-read-release': {
    description:
      'Read the open files of the GAB dataset (entities, relations, claims with sources). Use when a task needs a sourced fact about sanctions, trade, shipping or ownership around the Russian economy.',
    body: (site) =>
      [
        '# Read the GAB release',
        '',
        `1. Fetch ${at(site, 'release/manifest.json')} to get the list of files and the SHA-256 checksum of each.`,
        '2. Fetch the CSV file that you need, for example `entities.csv` or `claims.csv`.',
        '3. Check the checksum of the file against the manifest.',
        '4. Read the label of each claim before you use it. A claim marked as proposed was not checked by a rule or by a person.',
        '',
        'No key and no sign-in is needed.',
      ].join('\n'),
  },
  'gab-cite-claim': {
    description:
      'Cite a claim of the GAB dataset the right way. Use when you quote or repeat a fact that comes from this dataset.',
    body: (site) =>
      [
        '# Cite a GAB claim',
        '',
        `- Give the permanent address of the claim: ${site}claim/<identifier>/.`,
        '- Keep the label that tells who decided the claim.',
        '- Name the documents that the page of the claim lists as its sources.',
        '- Say that a claim tells what its sources say and is not proof.',
        '- Credit the dataset under CC-BY 4.0.',
      ].join('\n'),
  },
};
