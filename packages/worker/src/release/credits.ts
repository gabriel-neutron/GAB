import type { ReleaseFile } from './csv-export.ts';
import type { ReleaseHeading } from './release-heading.ts';

// External constraint: each credit follows the words that the owner of the data asks for.
// - GEM: licence CC BY 4.0 asks for the name of the author, a link to the licence, and a note of
//   each change. https://creativecommons.org/licenses/by/4.0/
// - NASA FIRMS: NASA asks for this acknowledgement of the use of FIRMS data.
// - World Bank: the flare file states no licence, so the credit names the source and says that the release
//   holds derived facts.
// - OpenStreetMap: the release links to objects and copies no geometry, and the credit still names
//   the contributors.
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
];

/** The credits file of a release: each source of the hydrocarbon layer, with the words that its
 * licence asks for. */
export const releaseCredits = (heading: ReleaseHeading): ReleaseFile => ({
  path: 'credits.md',
  text: `# Credits\n\n${heading.title}\n\n${CREDITS.join('\n')}\n`,
});
