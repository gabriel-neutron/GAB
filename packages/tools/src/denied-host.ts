// The hosts that hold leaked data (research/AGENTS.md and a panel verdict). The contract of
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

// A name with no letter, digit, underscore or hyphen before it, and with any count of dots after it. The end also
// holds the separators of a query, so an address in a query of another page is refused.
const DENIED = new RegExp(
  String.raw`(?<![\p{L}\p{N}_-])(?:${DENIED_HOSTS.map((host) => host.replaceAll('.', String.raw`\.`)).join('|')})\.*(?:[:/?#&;=]|$)`,
  'iu',
);

// Each byte alone, so a bad sequence stops nothing. The result serves only this test.
const decodedOnce = (address: string): string =>
  address.replace(/%([0-9a-f]{2})/giu, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );

// Origin of the count: decided. An archive address holds one encoding, a copy of it two.
const DECODINGS = 5;

/** The refusal of an address on a denied host, or null for another address. */
export const deniedHostRefusal = (address: string): string | null => {
  const read = URL.parse(address.trim())?.href ?? address;
  let text = read;
  for (let turn = 0; turn <= DECODINGS; turn += 1) {
    if (DENIED.test(text)) return `the host of ${read} is on the deny list, so it gets no call`;
    text = decodedOnce(text);
  }
  return null;
};
