const KINDS: Readonly<Record<string, string>> = {
  n: 'node',
  w: 'way',
  r: 'relation',
  node: 'node',
  way: 'way',
  relation: 'relation',
};

/** The address of an OpenStreetMap object on openstreetmap.org, from its identifier in the record.
 * The record writes the identifier as `node/1`, `way/1`, `relation/1`, or in the short form `n1`,
 * `w1`, `r1`. Any other text gives null, because a bare number does not say the kind of object. */
export const osmLink = (identifier: unknown): string | null => {
  if (typeof identifier !== 'string') return null;
  const found = /^(node|way|relation|n|w|r)[/:]?(\d{1,15})$/iu.exec(identifier.trim());
  const kind = found?.[1];
  const number = found?.[2];
  if (kind === undefined || number === undefined) return null;
  const word = KINDS[kind.toLowerCase()];
  return word === undefined ? null : `https://www.openstreetmap.org/${word}/${number}`;
};
