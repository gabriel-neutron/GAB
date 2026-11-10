import type { ToolName } from '@gab/tools/catalogue';

// The tools of each worker role of the wave (method, section 4). One set of permissions must not
// allow propose and decide together, so the server itself lists and runs only these tools for a role.
// `start_lead` is in no role: nothing replaces the approval of the operator (research/AGENTS.md).

const READ_RECORD = [
  'search_graph',
  'read_entity',
  'neighbourhood',
  'list_vocabulary',
  'list_entities',
  'read_duplicate_identifiers',
  'read_event_pairs',
  'list_proposals',
  'find_document',
  'document_text',
  'find_line',
  'file_schema_sample',
  'job_status',
  'read_doubts',
  'read_waiting',
  'read_unit',
  'read_groups',
  'read_group',
  'read_decided',
  'read_leads',
] as const satisfies readonly ToolName[];

const SEARCH = ['web_search', 'news_search'] as const satisfies readonly ToolName[];

const STORE = [
  'archive_snapshot',
  'fetch_document',
  'eu_act',
  'store_saved_file',
  'site_image',
  'sentinel2_pairs',
  'telegram_channel',
  'gleif_lookup',
  'companies_house',
  'wikidata_ids',
  'sanctions_match',
  'ofac_sdn',
  'uk_sanctions_list',
  'vessel_events',
  'gfw_port_visits',
  'gfw_presence_grid',
  'firms_detections',
  'comtrade_data',
  'egrul_extract',
] as const satisfies readonly ToolName[];

const DECIDE = [
  'promote_unit',
  'reject_unit',
  'reject_relation',
  'join_unit',
  'promote_clean_proposals',
  'remove_act',
  'join_entities',
] as const satisfies readonly ToolName[];

export const WORKER_ROLES = {
  proposer: [...READ_RECORD, ...SEARCH, ...STORE, 'enqueue_extract', 'enqueue_mapping', 'propose'],
  reviewer: [...READ_RECORD, ...SEARCH, ...DECIDE],
  // A closer stores nothing: find_line is its line path for a list file, and read_page its live read.
  fact_closer: [...READ_RECORD, ...SEARCH, 'read_page'],
  // It works in the test stack, so it reads nothing of the real record through this server.
  build_closer: ['read_page'],
  panel: [...READ_RECORD, ...SEARCH],
  coder: [],
} as const satisfies Readonly<Record<string, readonly ToolName[]>>;

export type Role = keyof typeof WORKER_ROLES;

export const ROLES = Object.keys(WORKER_ROLES) as readonly Role[];

export const isRole = (text: string): text is Role => Object.hasOwn(WORKER_ROLES, text);
