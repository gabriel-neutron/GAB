import type { ReleaseFile } from './csv-export.ts';
import type { ReleaseHeading } from './release-heading.ts';
import type { ReleaseRecord } from './release-record.ts';

// External constraint: each credit follows the words that the owner of the data asks for.
// - GEM: licence CC BY 4.0 asks for the name of the author, a link to the licence, and a note of
//   each change. https://creativecommons.org/licenses/by/4.0/
// - NASA FIRMS: NASA asks for this acknowledgement of the use of FIRMS data.
// - World Bank: the flare file states no licence, so the credit names the source and says that the release
//   holds derived facts.
// - OpenStreetMap: the release links to objects and copies no geometry, and the credit still names
//   the contributors.
// - EOX: the Sentinel-2 cloudless layer of 2016 is under CC BY 4.0, and the service gives the
//   credit with the layer. A point placed on such an image cites the image.
const CREDITS = [
  '## Global Energy Monitor',
  '',
  'Facts about oil and gas fields, pipelines, LNG terminals, companies and their ownership come',
  'from the trackers of Global Energy Monitor (GEM), https://globalenergymonitor.org, under the',
  'Creative Commons Attribution 4.0 International licence,',
  'https://creativecommons.org/licenses/by/4.0/. GAB changed the data: it selected rows, it read',
  'each table into entities, relations and attributes, and it checked some of them. GEM does not',
  'endorse GAB or this release.',
  '',
  '## World Bank',
  '',
  'Flare data come from the Global Gas Flaring Reduction Partnership (GGFR) of the World Bank,',
  'https://www.worldbank.org/en/programs/gasflaringreduction. The file states no licence. The',
  'release holds facts and points derived from it, and does not hold the file itself.',
  '',
  '## NASA FIRMS',
  '',
  'We acknowledge the use of data and/or imagery from NASA’s Fire Information for Resource',
  'Management System (FIRMS), https://earthdata.nasa.gov/firms, part of NASA’s Earth Science',
  'Data and Information System (ESDIS).',
  '',
  '## OpenStreetMap',
  '',
  'A link to an object of OpenStreetMap, https://www.openstreetmap.org, in asset-links.csv.',
  '© OpenStreetMap contributors, under the Open Database Licence,',
  'https://www.openstreetmap.org/copyright. This release holds no OpenStreetMap geometry.',
  '',
  '## EOX Sentinel-2 cloudless 2016',
  '',
  'A point placed on a satellite image cites the image: EOxCloudless https://cloudless.eox.at by',
  'EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), under the Creative',
  'Commons Attribution 4.0 International licence, https://creativecommons.org/licenses/by/4.0/.',
  'The image shows each site as it was in 2016.',
];

// The credit of each provider that a claim of a release can cite. An empty list is a provider that
// the sections above already credit. A provider that is not here stops the release: a missing
// credit breaks the licence. A provider of internal tier (for example Global Fishing Watch) is not
// here on purpose, because its documents never reach a release.
const PROVIDER_CREDITS: ReadonlyMap<string, readonly string[]> = new Map([
  ['eox_s2cloudless_2016', []],
  ['gem', []],
  ['osm', []],
  ['own', []],
  [
    'copernicus_sentinel',
    ['## Copernicus Sentinel', '', 'Contains modified Copernicus Sentinel data.'],
  ],
  [
    'eu_eurlex',
    [
      '## EU Official Journal (EUR-Lex)',
      '',
      'Facts about EU sanctions cite acts of the Official Journal of the European Union, EUR-Lex,',
      'https://eur-lex.europa.eu, reused under Commission Decision 2011/833/EU. The release holds',
      'derived facts and citations, and does not hold the acts. The European Union does not',
      'endorse GAB or this release.',
    ],
  ],
  [
    'eu_fsf',
    [
      '## EU Financial Sanctions Files',
      '',
      'Facts about EU sanctions cite the consolidated list of the Financial Sanctions Files of the',
      'European Commission, reused under Commission Decision 2011/833/EU. The release holds derived',
      'facts and citations, and does not hold the list. The European Union does not endorse GAB or',
      'this release.',
    ],
  ],
  [
    'gleif',
    [
      '## GLEIF',
      '',
      'Legal entity identifiers and names of legal entities come from the Global Legal Entity',
      'Identifier Foundation (GLEIF), https://www.gleif.org, under the CC0 1.0 licence. The release',
      'holds derived facts and citations.',
    ],
  ],
  [
    'ofac_sdn',
    [
      '## OFAC Specially Designated Nationals list',
      '',
      'Facts about US sanctions cite the Specially Designated Nationals list of the Office of Foreign',
      'Assets Control (OFAC) of the US Department of the Treasury. The list is in the public domain.',
      'The release holds derived facts and citations, and does not hold the list.',
    ],
  ],
  [
    'uk_sanctions_list',
    [
      '## UK Sanctions List',
      '',
      'Contains public sector information licensed under the Open Government Licence v3.0,',
      'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/. Source: the UK',
      'Sanctions List of the Foreign, Commonwealth & Development Office. The release holds derived',
      'facts and citations, and does not hold the list.',
    ],
  ],
]);

/** Thrown when a claim cites a provider that has no credit line. */
export class CreditFault extends Error {}

/** The credits file of a release: each source of the hydrocarbon layer, with the words that its
 * licence asks for, and the credit of each provider in `providers`, the providers of the
 * documents that the exported claims cite. Throws a `CreditFault` for a provider with no credit
 * line. */
export const releaseCredits = (
  heading: ReleaseHeading,
  providers: ReadonlySet<string>,
): ReleaseFile => {
  const lines = [...providers].sort().flatMap((id) => {
    const credit = PROVIDER_CREDITS.get(id);
    if (credit === undefined)
      throw new CreditFault(`The provider ${id} has no credit line in the credits of the release.`);
    return credit.length === 0 ? [] : ['', ...credit];
  });
  return {
    path: 'credits.md',
    text: `# Credits\n\n${heading.title}\n\n${[...CREDITS, ...lines].join('\n')}\n`,
  };
};

/** The ids of the providers of the documents that the claims of a record cite, in the passages
 * and in the sources. A document with no provider is left out: it is never public. */
export const claimProviders = (record: ReleaseRecord): ReadonlySet<string> => {
  const found = new Set<string>();
  for (const claim of record.claims)
    for (const id of [...claim.sources, ...claim.passages.map((one) => one.document)]) {
      const provider = record.documents.get(id)?.provider;
      if (provider !== null && provider !== undefined) found.add(provider);
    }
  return found;
};
