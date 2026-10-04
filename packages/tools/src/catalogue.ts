import { documentText } from './document-text.ts';
import { enqueueExtract } from './enqueue-extract.ts';
import { jobStatus } from './job-status.ts';
import { lookupEntity } from './lookup-entity.ts';
import { neighbourhood } from './neighbourhood.ts';
import { proposalRead } from './proposal-read.ts';
import { proposeChange } from './propose-change.ts';
import { searchGraph } from './search-graph.ts';

/** Every tool that is built, once. A surface adapts a profile of this list and holds no logic. */
export const CATALOGUE = [
  searchGraph,
  neighbourhood,
  documentText,
  lookupEntity,
  proposalRead,
  proposeChange,
  enqueueExtract,
  jobStatus,
] as const;

export type ToolName = (typeof CATALOGUE)[number]['name'];
