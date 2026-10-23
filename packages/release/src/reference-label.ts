/** The words of the fifth label of a release, for a claim that a reference dataset gave. The
 * database words the first four labels and gives the disclaimer. A release adds this one line
 * to the list of labels, so the files and the site explain every label that a claim can carry. */
export const REFERENCE_LABEL_LINE =
  '- **Reference dataset … — GAB did not check it:** the claim comes from a published dataset, as GEM, that the operator approved as a whole. No person read the claim, and GAB did not check it. This is not a check by the operator.';

const LIST_ITEM = '- ';

/** The disclaimer with the line of the reference dataset after its last label. A disclaimer that
 * holds the line already, or that holds no list of labels, stays as it is. */
export const withReferenceLabel = (disclaimer: string): string => {
  if (disclaimer.includes('**Reference dataset')) return disclaimer;
  const lines = disclaimer.split('\n');
  const last = lines.findLastIndex((line) => line.startsWith(LIST_ITEM));
  if (last === -1) return disclaimer;
  return [...lines.slice(0, last + 1), REFERENCE_LABEL_LINE, ...lines.slice(last + 1)].join('\n');
};
