// The label of a claim that a reference dataset gave. No person read such a claim, and the
// operator approved the dataset as a whole, so it must not read as a check by the operator.
const REFERENCE = /^reference dataset /iu;

/** The label of a claim as the release words it. A reference dataset label is a badge of its own
 * kind: a dashed edge and a word, so it is never mistaken for the validation of the operator.
 * The word is the mark, and the edge only backs it. */
export function LabelBadge({ label }: { readonly label: string }) {
  if (!REFERENCE.test(label)) return label;
  return (
    <span className="inline-block border border-dashed border-foreground px-1">
      <span className="font-semibold">Reference dataset, not checked by GAB. </span>
      {label}
    </span>
  );
}
