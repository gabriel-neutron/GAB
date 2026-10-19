/** The panel of the map for a selection that the map cannot draw: one sentence that says why. */
export function UnplacedNotice({ words }: { readonly words: string }) {
  return (
    <aside
      aria-label="Detail"
      className="w-96 shrink-0 border-l border-border bg-sidebar p-2 text-xs text-label"
    >
      <p>{words}</p>
    </aside>
  );
}
