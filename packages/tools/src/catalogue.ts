import { archiveSnapshot } from './archive-snapshot.ts';
import { companiesHouse } from './companies-house.ts';
import { documentText } from './document-text.ts';
import { enqueueExtract } from './enqueue-extract.ts';
import { fetchDocument } from './fetch-document.ts';
import { fileSchemaSample } from './file-schema-sample.ts';
import { findDocument } from './find-document.ts';
import { gleifLookup } from './gleif-lookup.ts';
import { jobStatus } from './job-status.ts';
import { listProposals } from './list-proposals.ts';
import { listVocabulary } from './list-vocabulary.ts';
import { neighbourhood } from './neighbourhood.ts';
import { newsSearch } from './news-search.ts';
import { propose } from './propose.ts';
import { readEntity } from './read-entity.ts';
import { searchGraph } from './search-graph.ts';
import { startLead } from './start-lead.ts';
import { telegramChannel } from './telegram-channel.ts';
import { webSearch } from './web-search.ts';
import { wikidataIds } from './wikidata-ids.ts';

/** Every tool that is built, once. A surface adapts a part of this list and holds no logic. */
export const CATALOGUE = [
  searchGraph,
  readEntity,
  neighbourhood,
  listVocabulary,
  listProposals,
  findDocument,
  documentText,
  fileSchemaSample,
  jobStatus,
  webSearch,
  newsSearch,
  archiveSnapshot,
  fetchDocument,
  telegramChannel,
  gleifLookup,
  companiesHouse,
  wikidataIds,
  enqueueExtract,
  startLead,
  propose,
] as const;

export type ToolName = (typeof CATALOGUE)[number]['name'];
