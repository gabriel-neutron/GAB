// The origin of a fact that only a party to the conflict states. A fact has a party origin when
// each document that it cites is published by a state body of one party (Russia or Ukraine). The
// rule reads only the address of each document, so the record, the release, the site and the
// report give the same answer. It states who publishes the documents. It never rates a source.

export type Party = 'UA' | 'RU';

/** A state body of a party to the conflict, and the place where it publishes. */
interface Publisher {
  /** The registrable host. Its subdomains count too. */
  readonly host: string;
  /** The first segment of the path, for a host that many publishers share (a channel of t.me). */
  readonly channel?: string;
  readonly party: Party;
  /** The name of the body, as the label gives it. */
  readonly name: string;
}

// A closed list. A state register (a company register, a list of a central bank, the official
// publication of a law) is not on it: an entry there is a record of the state, not a statement of
// a party about the other side. A state company and a state media outlet are not on it either.
const PUBLISHERS: readonly Publisher[] = [
  { host: 'gur.gov.ua', party: 'UA', name: 'GUR, the military intelligence of Ukraine' },
  { host: 'mil.gov.ua', party: 'UA', name: 'the Ministry of Defence of Ukraine' },
  { host: 'mod.gov.ua', party: 'UA', name: 'the Ministry of Defence of Ukraine' },
  { host: 'zsu.gov.ua', party: 'UA', name: 'the Armed Forces of Ukraine' },
  {
    host: 't.me',
    channel: 'generalstaffzsu',
    party: 'UA',
    name: 'the General Staff of the Armed Forces of Ukraine',
  },
  {
    host: 't.me',
    channel: 'ukr_sof',
    party: 'UA',
    name: 'the Special Operations Forces of Ukraine',
  },
  { host: 'kremlin.ru', party: 'RU', name: 'the President of Russia' },
  { host: 'government.ru', party: 'RU', name: 'the Government of Russia' },
  { host: 'mil.ru', party: 'RU', name: 'the Ministry of Defence of Russia' },
  { host: 'mid.ru', party: 'RU', name: 'the Ministry of Foreign Affairs of Russia' },
];

const PARTY_NAMES: Readonly<Record<Party, string>> = { UA: 'Ukraine', RU: 'Russia' };

// A copy in the Wayback Machine keeps the address of the page that it copies.
const ARCHIVED = /^https?:\/\/web\.archive\.org\/web\/[^/]+\/(.+)$/iu;

// The host and the path of a web address. The user part and the port are not the host.
const PARTS = /^(?:https?:\/\/)?(?:[^/@?#]*@)?([^/:?#]+)(?::\d+)?([^?#]*)/iu;

const publisherOf = (address: string): Publisher | undefined => {
  const original = ARCHIVED.exec(address.trim())?.[1] ?? address.trim();
  const parts = PARTS.exec(original);
  if (parts === null) return undefined;
  // A host can end with the dot of the root, and telegram.me is the other name of t.me.
  const host = (parts[1] ?? '')
    .toLowerCase()
    .replace(/\.$/u, '')
    .replace(/^telegram\.me$/u, 't.me');
  // A t.me channel can also read as t.me/s/<channel>.
  const segments = (parts[2] ?? '')
    .toLowerCase()
    .split('/')
    .filter((one) => one !== '');
  const channel = segments[0] === 's' ? segments[1] : segments[0];
  return PUBLISHERS.find(
    (one) =>
      (host === one.host || host.endsWith(`.${one.host}`)) &&
      (one.channel === undefined || one.channel === channel),
  );
};

/** The party of the state body that publishes the document at this address, or ''. */
export const documentParty = (address: string): Party | '' => publisherOf(address)?.party ?? '';

/** The party when each address is published by a state body of that one party, or '' when a
 * document of another publisher is cited, when two parties are cited, or when no address is known. */
export const partyOrigin = (addresses: readonly string[]): Party | '' => {
  const parties = new Set(addresses.map(documentParty));
  const [only] = parties;
  return parties.size === 1 && only !== undefined ? only : '';
};

/** The short mark of a document or a fact of a party, where the space is small. */
export const partyMark = (party: Party): string => `Party source (${PARTY_NAMES[party]})`;

/** The short mark of a fact whose each document a state body of one party publishes, or ''. */
export const factMark = (addresses: readonly string[]): string => {
  const party = partyOrigin(addresses);
  return party === '' ? '' : partyMark(party);
};

/** The short mark of the document at this address, or '' when no state body of a party to the
 * conflict publishes it. */
export const documentMark = (address: string): string => {
  const party = documentParty(address);
  return party === '' ? '' : partyMark(party);
};

/** The words that show the origin of a fact to the reader, or '' when the fact has no party
 * origin. They name the body when one body publishes each document, and the state when more do.
 * They state the origin, and say nothing about the truth of the fact. */
export const partyLabel = (addresses: readonly string[]): string => {
  const party = partyOrigin(addresses);
  if (party === '') return '';
  const state = PARTY_NAMES[party];
  const names = new Set(addresses.map((one) => publisherOf(one)?.name));
  const cited =
    names.size === 1
      ? `Cited source: ${[...names][0]}.`
      : `Cited sources: state bodies of ${state}.`;
  return `${cited} ${state} is a party to the conflict. GAB cites no other source for this fact.`;
};
