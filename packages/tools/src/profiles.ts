import type { ToolName } from './catalogue.ts';

// A small model chooses badly among many tools, so no consumer sees more than eight.
export const PROFILE_LIMIT = 8;

// A tool that is not built is absent from its profile and never a stub: a model that is offered a
// tool calls it. The mapper holds no tool until its first tool is built. The fetch tool stores a
// document, and the chat reads as a role that stores nothing, so the chat profile does not hold it.
export const PROFILES = {
  research: [
    'search_graph',
    'neighbourhood',
    // The research AI looks up an identifier before it proposes an entity, so it does not make a
    // second entity for one real object.
    'lookup_entity',
    'document_text',
    'fetch_document',
    'propose_change',
    'enqueue_extract',
    'job_status',
  ],
  extractor: ['document_text', 'lookup_entity', 'propose_change'],
  mapper: [],
  verifier: ['document_text', 'proposal_read'],
  chat: ['search_graph', 'neighbourhood', 'document_text', 'enqueue_extract'],
} as const satisfies Record<string, readonly ToolName[]>;

export type ProfileName = keyof typeof PROFILES;

/** Throws a sentence for each profile of more than eight tools or name outside the catalogue. */
export const checkProfiles = (
  profiles: Readonly<Record<string, readonly string[]>>,
  catalogue: readonly { readonly name: string }[],
): void => {
  const known = new Set(catalogue.map((tool) => tool.name));
  const faults: string[] = [];
  for (const [profile, names] of Object.entries(profiles)) {
    if (names.length > PROFILE_LIMIT)
      faults.push(
        `the profile ${profile} holds ${names.length} tools, and the limit is ${PROFILE_LIMIT}`,
      );
    for (const name of names)
      if (!known.has(name))
        faults.push(`the profile ${profile} names ${name}, which the catalogue does not hold`);
  }
  if (faults.length > 0) throw new Error(faults.join('; '));
};
