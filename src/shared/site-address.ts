/** The address of a page or a file of this site, from its path at the root. A site built for a
 * base folder serves each path under that folder. */
export const siteAddress = (path: string): string =>
  `${import.meta.env.BASE_URL.replace(/\/$/u, '')}${path}`;
