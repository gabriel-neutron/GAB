// Sigma's own hover card paints one fixed colour that no token reaches, so it drew black on
// white over a dark canvas: `defaultDrawNodeHover` is off and this draws in the theme tokens.
// It takes no pointer event, or the label sits under the pointer and the leave event never comes.
export const CANVAS_LABEL_CLASS = [
  'pointer-events-none absolute top-0 left-0 z-10 flex max-w-64 flex-col',
  'border border-border bg-popover px-1.5 py-0.5',
  'font-sans text-xs text-popover-foreground',
  '[&>*]:truncate',
].join(' ');

// Three lines and not one: `A - type - B` truncated all three names at the width of the box.
// The tuple is fixed length, so a caller that draws one line at a time tests none for undefined.
// The detail panel reads these words too, so a relation is worded once for every surface.
export const relationLines = (
  from: string,
  type: string,
  to: string,
): readonly [string, string, string] => [from, `↓ ${relationTypeWords(type)}`, to];

// `berthed_at` reads as `berthed at`, once, for the two canvases and for the panel. The raw
// identifier then appears on no screen, which is the cost of one wording.
export const relationTypeWords = (type: string): string => type.replaceAll('_', ' ');

// The count is the words the size owes a reader: the graph sizes a node by degree, and a size
// alone cannot be read by anyone who cannot compare two discs. The map draws one radius, so the
// count states what the picture never draws. A bare figure under a name reads as a year.
export const entityLines = (label: string, relations: number): readonly string[] => [
  label,
  relations === 1 ? '1 relation' : `${relations} relations`,
];

// The label is placed by its bottom centre, so it stands clear of the dot and of the pointer.
// A label centred on the point would cover the thing the analyst is pointing at.
export const CANVAS_LABEL_OFFSET = 12;

// One rule for both surfaces: bottom centre, one offset above the point. A surface with its
// own transform would drift from the other the first time either was tuned.
export const canvasLabelTransform = (x: number, y: number): string =>
  `translate(${x}px, ${y - CANVAS_LABEL_OFFSET}px) translate(-50%, -100%)`;
