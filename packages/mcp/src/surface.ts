import type { ToolName } from '@gab/tools/catalogue';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

// A client allows a read with no question and asks the operator before a write, so each tool says
// which one it is. No tool deletes or replaces a row, because the ledger is append-only.
const READ_RECORD: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const READ_WEB: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };

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
  job_status: READ_RECORD,
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
  // A second call meets the open job and is refused.
  enqueue_extract: {
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
} as const satisfies Record<ToolName, ToolAnnotations>;
