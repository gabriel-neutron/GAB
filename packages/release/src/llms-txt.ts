import { AI_CRAWLER_POLICY } from './ai-policy.ts';
import type { SiteManifest } from './site-manifest.ts';

/** The main pages of the site, by folder, with a short note. The folder is empty for the home page. */
const MAIN_PAGES: readonly (readonly [folder: string, name: string, note: string])[] = [
  ['', 'Report', 'The report on the nodes that sustain the war.'],
  ['nodes', 'Release overview', 'The nodes, the labels and the counts of the release.'],
  ['map', 'Map', 'The assets that have a position.'],
  ['downloads', 'Downloads', 'The files of the release, with their checksums.'],
  ['method', 'About', 'The method, the labels, the licence and the contacts.'],
  ['glossary', 'Glossary', 'The terms and the types of relation.'],
  ['ai-use', 'AI use', 'The licence, how to cite a claim and the limits of a claim.'],
];

/** The file `llms.txt` of the site, as the proposal at llmstxt.org words it. Each address is
 * absolute and starts with `site`, which ends with a slash. */
export const llmsTxt = (manifest: SiteManifest, site: string): string => {
  const lines = [
    '# GAB dataset',
    '',
    '> Entities, relations and claims, each with a label that tells who decided it and the ' +
      `documents that state it. Release ${manifest.version}, ${manifest.date}.`,
    '',
    'A claim tells what its sources say. It is not proof. Keep the label of a claim when you copy it.',
    AI_CRAWLER_POLICY === 'allow'
      ? 'Reading is allowed. Cite the claim that you use.'
      : 'The operator does not allow the known AI crawlers to read this site.',
    '',
    '## Pages',
    '',
    ...MAIN_PAGES.map(
      ([folder, name, note]) => `- [${name}](${site}${folder === '' ? '' : `${folder}/`}): ${note}`,
    ),
    '',
    '## Files of the release',
    '',
    ...manifest.files.map(
      (file) => `- [${file.path}](${site}release/${file.path}): sha256 ${file.sha256}`,
    ),
    `- [manifest.json](${site}release/manifest.json): the list of the files, the licence and the contacts`,
    '',
    '## How to cite',
    '',
    `- The dataset: GAB dataset, release ${manifest.version}, ${manifest.date}. ${site}`,
    `- A claim: its permanent address, ${site}claim/<identifier>/, and the sources that its page lists.`,
    `- An entity: its permanent address, ${site}entity/<identifier>/.`,
    '',
    '## Licence and contact',
    '',
    '- The dataset is under CC-BY 4.0. Each row shows its own licence.',
    `- Report an error: ${manifest.contacts.reportError}`,
    `- Right of reply: ${manifest.contacts.rightOfReply}`,
    '',
  ];
  return lines.join('\n');
};
