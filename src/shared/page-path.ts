/** The path of a page with no end slash. A page of the release opens at its folder address, with
 * an end slash, and its render had none. The root keeps its one slash. */
export const pagePath = (pathname: string): string => pathname.replace(/(.)\/$/u, '$1');
