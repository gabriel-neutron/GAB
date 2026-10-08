import type { SourceDocument } from './unit-page';

// An address with or without its scheme: a host with a dot, then a path, and no space.
const ADDRESS = /^(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+\/\S*$/iu;

// A long address takes many lines; the host and the last part of the path name the file.
const shortAddress = (address: string): string => {
  try {
    const url = new URL(/^https?:\/\//iu.test(address) ? address : `https://${address}`);
    const host = url.host.replace(/^www\./u, '');
    const file = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '');
    return file === '' ? host : `${host}: ${file}`;
  } catch {
    return address;
  }
};

/** The name of a document on the screen: its title, or the host and the file name where the
 * title is an address or is empty. */
export function documentName(document: SourceDocument): string {
  const title = document.title.trim();
  if (title !== '' && !ADDRESS.test(title)) return title;
  const address = title === '' ? document.uri : title;
  return address === null || address === '' ? document.id : shortAddress(address);
}
