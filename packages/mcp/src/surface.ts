import type { ToolName } from '@gab/tools/catalogue';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

// A client allows a read with no question and asks the operator before a write, so each tool says
// which one it is. No tool deletes or replaces a row, because the ledger is append-only.
const READ_RECORD: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const READ_WEB: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };
const DECIDE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

/** Each tool of the research surface, in the order a client lists it, and how a client treats
 * it. The type holds every tool of the catalogue, so a new tool cannot stay off the list. */
export const RESEARCH_TOOLS = {
  search_graph: READ_RECORD,
  read_entity: READ_RECORD,
  neighbourhood: READ_RECORD,
  list_vocabulary: READ_RECORD,
  list_proposals: READ_RECORD,
  find_document: READ_RECORD,
  document_text: READ_RECORD,
  file_schema_sample: READ_RECORD,
  job_status: READ_RECORD,
  // The reads of the review page. The queue, the groups, the decided acts and the leads.
  read_doubts: READ_RECORD,
  read_waiting: READ_RECORD,
  read_unit: READ_RECORD,
  read_groups: READ_RECORD,
  read_group: READ_RECORD,
  read_decided: READ_RECORD,
  read_leads: READ_RECORD,
  web_search: READ_WEB,
  news_search: READ_WEB,
  // A capture asks the archive to keep a copy of a page, which is a write outside the record.
  archive_snapshot: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  // The same bytes are stored once, so a second fetch of a page writes nothing.
  fetch_document: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  // The same bytes are stored once, so a second store of a saved file writes nothing.
  store_saved_file: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  // The same post is stored once, so a second read of a post writes nothing.
  telegram_channel: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  // The same file is stored once, so a second read of an unchanged list writes nothing.
  ofac_sdn: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  // The same file is stored once, so a second read of an unchanged list writes nothing.
  uk_sanctions_list: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  // The same act is stored once, so a second read writes nothing.
  eu_act: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  // The same answer is stored once, so a second lookup writes nothing. A name search stores
  // nothing.
  gleif_lookup: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  companies_house: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  wikidata_ids: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  // Each call reads and stores one record, so a second call writes nothing. A search stores
  // nothing.
  sanctions_match: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  vessel_events: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  // A second call meets the open job and is refused.
  enqueue_extract: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  // A second call meets the open job and is refused.
  enqueue_mapping: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  // Each call starts one more lead.
  start_lead: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  // The door returns the act that waits, so a retry writes nothing twice.
  propose: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  // The decisions of an AI reviewer, as the review page takes them, with the group action. A
  // decided act is frozen, so a second call is refused, and the ledger keeps the act: nothing is
  // deleted.
  promote_unit: DECIDE,
  reject_unit: DECIDE,
  reject_relation: DECIDE,
  promote_clean_proposals: DECIDE,
} as const satisfies Record<ToolName, ToolAnnotations>;
