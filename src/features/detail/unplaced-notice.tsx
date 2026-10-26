/** The panel of the map for a selection that the map cannot draw: one sentence that says why. */
export function UnplacedNotice({ words }: { readonly words: string }) {
  return (
    <aside aria-label="Detail" className="w-full bg-surface p-4 text-body-sm text-muted-foreground">
      <p>{words}</p>
    </aside>
  );
}
