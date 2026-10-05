import { documentText } from './document-text.ts';
import { enqueueExtract } from './enqueue-extract.ts';
import { fetchDocument } from './fetch-document.ts';
import { jobStatus } from './job-status.ts';
import { lookupEntity } from './lookup-entity.ts';
import { neighbourhood } from './neighbourhood.ts';
import { proposalRead } from './proposal-read.ts';
import { proposeChange } from './propose-change.ts';
import { putClaimReading } from './put-claim-reading.ts';
import { searchGraph } from './search-graph.ts';

/** Every tool that is built, once. A surface adapts a profile of this list and holds no logic. */
export const CATALOGUE = [
  searchGraph,
  neighbourhood,
  documentText,
  fetchDocument,
  lookupEntity,
  proposalRead,
  proposeChange,
  putClaimReading,
  enqueueExtract,
  jobStatus,
] as const;

export type ToolName = (typeof CATALOGUE)[number]['name'];
