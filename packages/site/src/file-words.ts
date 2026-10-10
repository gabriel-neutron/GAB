/** What each file of a release holds, by its path. A file that this list does not name shows no
 * words. */
export const FILE_WORDS: Readonly<Record<string, string>> = {
  'entities.csv': 'The public entities, one row each.',
  'relations.csv': 'The public relations, one row each.',
  'claims.csv': 'The public claims, one row for each claim and each cited passage.',
  'merges.csv': 'Each merge and each undo, and the entity that each merged identifier gives.',
  'alignment-matrix.csv': 'The EU, OFAC and UK listings of each vessel by IMO number.',
  'critical-nodes.csv': 'The critical nodes table of the home page.',
  'entities.geojson': 'The entities with a position, with the columns of entities.csv.',
  'dataset.jsonld': 'The entities, relations, claims and documents as linked data.',
  'changelog.csv': 'The changes since the previous release.',
  'manifest.json': 'The size and the SHA-256 checksum of each other file.',
};
