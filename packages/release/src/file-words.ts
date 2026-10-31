/** What each file of a release holds, by its path. A file that this list does not name shows no
 * words. */
export const FILE_WORDS: Readonly<Record<string, string>> = {
  'entities.csv':
    'The public entities, one row each, with the method of geolocation of each place.',
  'relations.csv': 'The public relations, one row each.',
  'claims.csv': 'The public claims, one row for each claim and each cited passage.',
  'merges.csv': 'Each merge and each undo, and the entity that each merged identifier gives.',
  'alignment-matrix.csv': 'The EU, OFAC and UK listings of each vessel by IMO number.',
  'critical-nodes.csv': 'The critical nodes table of the home page.',
  'asset-links.csv':
    'The OpenStreetMap link and the own point of each asset that has an OpenStreetMap identifier.',
  'volumes.csv':
    'The volume table of the research, each row with its class, its unit and its source, joined to the physical links of the map.',
  'observations.csv':
    'The decided figures of the record, such as monthly prices, each with its period, its unit, its source and its licence. A figure with a restricted licence is not in the file.',
  'release-notes.md':
    'The notes of the release, with the share of the places that have no stated method of geolocation, and the share of the public claims that have a full NATO pair when the release shows it.',
  'credits.md': 'The credit of each source, as its licence asks.',
  'entities.geojson':
    'The entities with a position, with the columns of entities.csv, the asset kind and the dated sanctions of each facility and port: a measure that names it, or one that names its direct operator or owner.',
  'dataset.jsonld': 'The entities, relations, claims and documents as linked data.',
  'changelog.csv': 'The changes since the previous release.',
  'manifest.json': 'The size and the SHA-256 checksum of each other file.',
};
