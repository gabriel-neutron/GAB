// Each closed set is written twice: once in a CHECK, and once here. A CHECK reaches no generated
// type, so the drift check cannot see one. A database test compares the two, and it is the only
// thing that keeps them equal.

const ENDPOINT = ['entity', 'relation'] as const;

/** Every closed set a CHECK of a base table declares, named by that table and that column. */
export const CLOSED_SET = {
  'documents.kind': ['file', 'url', 'api', 'report', 'manual'],
  'documents.admiralty_origin': ['machine', 'arbitrated', 'human'],
  'relations.src_kind': ENDPOINT,
  'relations.dst_kind': ENDPOINT,
  'proposals.op': [
    'create_entity',
    'update_attrs',
    'delete_entity',
    'create_relation',
    'update_relation',
    'delete_relation',
    'merge_entities',
  ],
  'proposals.target_kind': ENDPOINT,
  'proposals.author_role': ['gabriel_agent', 'gabriel_app'],
  'proposals.status': ['pending', 'accepted', 'rejected'],
} as const;
