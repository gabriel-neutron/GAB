import { archiveSnapshot } from './archive-snapshot.ts';
import { documentText } from './document-text.ts';
import { enqueueExtract } from './enqueue-extract.ts';
import { fetchDocument } from './fetch-document.ts';
import { jobStatus } from './job-status.ts';
import { lookupEntity } from './lookup-entity.ts';
import { neighbourhood } from './neighbourhood.ts';
import { newsSearch } from './news-search.ts';
import { proposalRead } from './proposal-read.ts';
import { propose } from './propose.ts';
import { searchGraph } from './search-graph.ts';
import { webSearch } from './web-search.ts';

/** Every tool that is built, once. A surface adapts a profile of this list and holds no logic. */
export const CATALOGUE = [
  searchGraph,
  neighbourhood,
  documentText,
  fetchDocument,
  lookupEntity,
  proposalRead,
  propose,
  enqueueExtract,
  jobStatus,
  webSearch,
  archiveSnapshot,
  newsSearch,
] as const;

export type ToolName = (typeof CATALOGUE)[number]['name'];
