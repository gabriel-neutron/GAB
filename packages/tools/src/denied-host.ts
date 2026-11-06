// The hosts that hold leaked data (research/AGENTS.md). The contract of the report ends if the record
// uses such data, so a read of one of them opens no connection. The whole address is read, so a copy
// in a web archive of such a page is refused too. A host name can end in a dot, and it is the same host.
// shortcut: this list holds only the collections that the research rules name, BLD-07 makes it
// exhaustive and adds the refusal to the store tools.
const DENIED =
  /(?:\/|\.|@)(?:wikileaks\.org|offshoreleaks\.icij\.org|ddosecrets\.(?:com|org)|aleph\.occrp\.org)\.?(?:[:/?#]|$)/iu;

/** The refusal of an address on a denied host, or null for another address. */
export const deniedHostRefusal = (address: string): string | null => {
  const read = URL.parse(address.trim())?.href ?? address;
  return DENIED.test(read) ? `the host of ${read} is on the deny list, so it gets no call` : null;
};
