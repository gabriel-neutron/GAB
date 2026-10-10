import { archiveSnapshot } from './archive-snapshot.ts';
import { companiesHouse } from './companies-house.ts';
import { documentText } from './document-text.ts';
import { enqueueExtract } from './enqueue-extract.ts';
import { euAct } from './eu-act.ts';
import { enqueueMapping } from './enqueue-mapping.ts';
import { fetchDocument } from './fetch-document.ts';
import { fileSchemaSample } from './file-schema-sample.ts';
import { findDocument } from './find-document.ts';
import { gleifLookup } from './gleif-lookup.ts';
import { jobStatus } from './job-status.ts';
import { listProposals } from './list-proposals.ts';
import { listVocabulary } from './list-vocabulary.ts';
import { neighbourhood } from './neighbourhood.ts';
import { newsSearch } from './news-search.ts';
import { promoteCleanProposals } from './promote-clean-proposals.ts';
import { promoteUnit } from './promote-unit.ts';
import { propose } from './propose.ts';
import { readDecided } from './read-decided.ts';
import { readDoubts } from './read-doubts.ts';
import { readEntity } from './read-entity.ts';
import { readGroup } from './read-group.ts';
import { readGroups } from './read-groups.ts';
import { readLeads } from './read-leads.ts';
import { readUnit } from './read-unit.ts';
import { readWaiting } from './read-waiting.ts';
import { rejectRelation } from './reject-relation.ts';
import { rejectUnit } from './reject-unit.ts';
import { sanctionsMatch } from './sanctions-match.ts';
import { searchGraph } from './search-graph.ts';
import { startLead } from './start-lead.ts';
import { storeSavedFile } from './store-saved-file.ts';
import { telegramChannel } from './telegram-channel.ts';
import { vesselEvents } from './vessel-events.ts';
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
  readDoubts,
  readWaiting,
  readUnit,
  readGroups,
  readGroup,
  readDecided,
  readLeads,
  webSearch,
  newsSearch,
  archiveSnapshot,
  fetchDocument,
  euAct,
  storeSavedFile,
  telegramChannel,
  gleifLookup,
  companiesHouse,
  wikidataIds,
  sanctionsMatch,
  vesselEvents,
  enqueueExtract,
  enqueueMapping,
  startLead,
  propose,
  promoteUnit,
  rejectUnit,
  rejectRelation,
  promoteCleanProposals,
] as const;

export type ToolName = (typeof CATALOGUE)[number]['name'];
