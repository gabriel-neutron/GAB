// The hosts that hold leaked data (research/AGENTS.md and the panel verdict of BLD-07). The contract of
// the report ends if the record uses such data, so a read of one of them opens no connection. The
// whole address is read, also in its percent-decoded form, so a copy in a web archive of such a page
// is refused too. A host name can end in a dot, and it is the same host. Only a collection enters
// this list: the articles of a news host stay allowed, so icij.org and occrp.org are not on it.

/** Each host of a named leak collection. A subdomain of a host is denied too. */
export const DENIED_HOSTS = [
  'wikileaks.org',
  'wikileaks.info',
  'offshoreleaks.icij.org',
  'ddosecrets.com',
  'ddosecrets.org',
  'distributeddenialofsecrets.com',
  'aleph.occrp.org',
  'data.occrp.org',
] as const;

const DENIED = new RegExp(
  String.raw`(?:/|\.|@)(?:${DENIED_HOSTS.map((host) => host.replaceAll('.', String.raw`\.`)).join('|')})\.?(?:[:/?#]|$)`,
  'iu',
);

const decoded = (address: string): string => {
  try {
    return decodeURIComponent(address);
  } catch {
    return address;
  }
};

/** The refusal of an address on a denied host, or null for another address. */
export const deniedHostRefusal = (address: string): string | null => {
  const read = URL.parse(address.trim())?.href ?? address;
  return DENIED.test(read) || DENIED.test(decoded(read))
    ? `the host of ${read} is on the deny list, so it gets no call`
    : null;
};
