import type { QueueFilter } from './review-workspace';
import type { FilterChoices } from './unit-page';

/** The stored filter without a group, a document or a proposer that the queue no longer offers,
 * because a decision emptied it. The same filter where nothing is removed. */
export function filterWithinChoices(filter: QueueFilter, choices: FilterChoices): QueueFilter {
  const group =
    filter.group !== null && !choices.groups.some((one) => one.id === filter.group)
      ? null
      : filter.group;
  const document =
    filter.document !== null && !choices.documents.some((one) => one.id === filter.document)
      ? null
      : filter.document;
  const proposer =
    filter.proposer !== null && !choices.proposers.includes(filter.proposer)
      ? null
      : filter.proposer;
  return group === filter.group && document === filter.document && proposer === filter.proposer
    ? filter
    : { ...filter, group, document, proposer };
}
