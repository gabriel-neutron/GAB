// The type of a document tells a reader what kind of text a source is. The type comes from the
// provider, the address and the title, in this order, and the first rule that matches decides.
// A document that no rule matches is `other`.

export const DOCUMENT_TYPES = [
  'legal_act',
  'register_entry',
  'press_release',
  'report',
  'official_publication',
  'reference',
  'company_publication',
  'telegram_post',
  'ngo_publication',
  'news_article',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentFacts {
  readonly uri: string | null;
  readonly title: string;
  readonly provider: string | null;
}

/** The host of a web address, in lower case with no "www." in front, or null. */
export const hostOf = (uri: string | null): string | null => {
  if (uri === null) return null;
  const parsed = URL.parse(uri);
  if (parsed === null || parsed.hostname === '') return null;
  return parsed.hostname.toLowerCase().replace(/^www\./u, '');
};

const PROVIDER_TYPES: Readonly<Record<string, DocumentType>> = {
  eu_eurlex: 'legal_act',
  ofac_sdn: 'register_entry',
  uk_sanctions_list: 'register_entry',
};

interface Rule {
  readonly type: DocumentType;
  readonly host?: RegExp;
  readonly address?: RegExp;
  readonly title?: RegExp;
}

// External constraint: the hosts and the paths of the publishers, as they answer on 19 October 2026.
const RULES: readonly Rule[] = [
  {
    type: 'legal_act',
    host: /^(?:eur-lex\.europa\.eu|publications\.europa\.eu|legislation\.gov\.uk|federalregister\.gov|pravo\.gov\.ru|publication\.pravo\.gov\.ru|laws-lois\.justice\.gc\.ca|govinfo\.gov)$/u,
  },
  {
    type: 'register_entry',
    host: /(?:^|\.)(?:opencorporates\.com|gleif\.org|company-information\.service\.gov\.uk|egrul\.nalog\.ru|sanctionslistservice\.ofac\.treas\.gov|sanctionssearch\.ofac\.treas\.gov|ofac\.treasury\.gov|sanctionslist\.fcdo\.gov\.uk|search-uk-sanctions-list\.service\.gov\.uk|opensanctions\.org)$/u,
  },
  {
    type: 'reference',
    host: /(?:^|\.)(?:wikipedia\.org|wikidata\.org|gem\.wiki|openstreetmap\.org)$/u,
  },
  {
    type: 'company_publication',
    host: /(?:^|\.)(?:rosneft\.com|rosneft\.de|lukoil\.com|tupras\.com\.tr|cpc-online\.ru|mero\.cz)$/u,
  },
  {
    type: 'telegram_post',
    host: /(?:^|\.)(?:t\.me|telegram\.me|tgstat\.ru)$/u,
  },
  {
    type: 'ngo_publication',
    host: /(?:^|\.)(?:bruegel\.org|globalenergymonitor\.org|globalfishingwatch\.org|amnesty\.org|hrw\.org|transparency\.org|globalwitness\.org|c4ads\.org|bellingcat\.com|energyandcleanair\.org|kse\.ua|csis\.org|rusi\.org|acleddata\.com)$/u,
  },
  {
    type: 'news_article',
    host: /(?:^|\.)(?:reuters\.com|bloomberg\.com|ft\.com|bbc\.com|bbc\.co\.uk|kyivindependent\.com|themoscowtimes\.com|meduza\.io|kommersant\.ru|rbc\.ru|interfax\.ru|tass\.ru|lloydslist\.com|tradewindsnews\.com|splash247\.com|theguardian\.com|politico\.eu|nytimes\.com|wsj\.com|ukrinform\.net|ria\.ru|kyivpost\.com|sputnikglobe\.com|pravda\.com\.ua|ukrinform\.ua|gcaptain\.com|economictimes\.indiatimes\.com)$/u,
  },
  {
    type: 'legal_act',
    title:
      /^(?:(?:council|commission)(?: implementing| delegated)? (?:regulation|decision|directive)|executive order|regulation \(|directive \(|the [^.]{0,80}(?:order|regulations) \d{4})\b/iu,
  },
  {
    type: 'press_release',
    address: /\/(?:press-?releases?|presscorner)(?:\/|$|\?)/iu,
    title: /\bpress release\b/iu,
  },
  {
    type: 'report',
    address: /\/reports?(?:\/|$|\?|-)/iu,
    title: /\b(?:report|annual review|white paper)\b/iu,
  },
  {
    type: 'official_publication',
    host: /(?:^|\.)(?:gov\.uk|treasury\.gov|state\.gov|kremlin\.ru|gur\.gov\.ua)$/u,
  },
];

const matches = (rule: Rule, host: string | null, address: string, title: string): boolean =>
  (host !== null && rule.host?.test(host) === true) ||
  rule.address?.test(address) === true ||
  rule.title?.test(title) === true;

// An archive keeps the page of another host: the address of that page follows in the path.
const ARCHIVE_HOST = /^(?:web\.archive\.org|archive\.ph|archive\.is)$/u;
const KEPT_ADDRESS = /\/(https?:\/\/.+)$/u;

/** The type of a document. */
export const documentType = (facts: DocumentFacts): DocumentType => {
  const byProvider = facts.provider === null ? undefined : PROVIDER_TYPES[facts.provider];
  if (byProvider !== undefined) return byProvider;
  const host = hostOf(facts.uri);
  const kept =
    host !== null && ARCHIVE_HOST.test(host) ? KEPT_ADDRESS.exec(facts.uri ?? '')?.[1] : undefined;
  if (kept !== undefined) return documentType({ ...facts, uri: kept });
  const address = URL.parse(facts.uri ?? '')?.pathname ?? '';
  return RULES.find((rule) => matches(rule, host, address, facts.title))?.type ?? 'other';
};
