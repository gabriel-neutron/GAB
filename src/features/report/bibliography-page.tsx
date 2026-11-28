import { Link } from '@tanstack/react-router';
import { GROUPS, citingNotes, groupedEntries, shortNoteNumbers, noteText } from './bibliography';
import { EntryText } from './entry-text';
import { sourceDocuments } from './note-documents';
import { entryAnchor, noteAnchor } from './note-ref';
import { ReportFrame } from './report-frame';
import { useContent, type ReportPath } from './use-content';

const SECTION = 'mt-12 border-t border-border pt-6 lg:grid lg:grid-cols-12 lg:gap-x-8';
const HEAD = 'text-report-lead text-balance lg:col-span-4';
const LIST = 'mt-4 space-y-4 lg:col-span-8 lg:mt-0';
const META = 'mt-1 block font-mono text-report-label text-label break-all';

/** The bibliography of the report: one entry for each source, in groups, each one at the anchor
 * that its references link to; then the short notes, at the anchors of their notes; then the
 * credits of the images of the report page. */
export function BibliographyPage() {
  const { parts, ui } = useContent();
  const { images } = ui.bibliography;
  const notes = parts.flatMap((part) => part.notes.map((note) => ({ ...note, slug: part.slug })));
  const citing = citingNotes(notes);
  const numbers = shortNoteNumbers(notes);
  return (
    <ReportFrame label={ui.bibliography.label}>
      <article className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            to={`/${ui.paths.report}` as ReportPath}
            className="inline-flex min-h-11 items-center text-report-small underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {ui.bibliography.back}
          </Link>
        </div>
        <h1 className="mt-6 text-report-heading text-balance">{ui.bibliography.title}</h1>
        <p className="mt-4 max-w-[72ch] text-report-small text-label">{ui.bibliography.intro}</p>
        {groupedEntries().map(([group, entries]) => (
          <section key={group} aria-labelledby={`refs-${group}`} className={SECTION}>
            <h2 id={`refs-${group}`} className={HEAD}>
              {GROUPS[group]}
            </h2>
            <ol className={LIST}>
              {entries.map((entry) => {
                const documents = sourceDocuments(entry, citing.get(entry.key) ?? []);
                const accessed = documents
                  .map((one) => one.retrievedAt)
                  .sort()
                  .at(-1);
                return (
                  <li
                    key={entry.key}
                    id={entryAnchor(entry.key)}
                    className="max-w-[72ch] scroll-mt-6 text-report-small target:bg-surface-secondary"
                  >
                    <span className="block font-medium">{entry.cite}</span>
                    <EntryText entry={entry} />
                    {accessed === undefined ? null : (
                      <span className={META}>
                        {ui.bibliography.accessed} {accessed} · {ui.bibliography.stored}{' '}
                        {documents.map((one) => one.id).join(', ')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <section aria-labelledby="refs-notes" className={SECTION}>
          <h2 id="refs-notes" className={HEAD}>
            {ui.bibliography.notes}
          </h2>
          <ol className={LIST}>
            {notes
              .filter((note) => numbers.has(note.id))
              .map((note) => (
                <li
                  key={note.id}
                  id={noteAnchor(note.slug, note.id)}
                  className="grid max-w-[72ch] scroll-mt-6 grid-cols-[2.5rem_minmax(0,1fr)] gap-3 text-report-small target:bg-surface-secondary"
                >
                  <span className="font-mono text-report-label text-label">
                    {numbers.get(note.id)}
                  </span>
                  <span className="break-words">{noteText(note.text)}</span>
                </li>
              ))}
          </ol>
        </section>
        <section aria-labelledby="notes-images" className={SECTION}>
          <h2 id="notes-images" className={HEAD}>
            {images.title}
          </h2>
          <ul className="mt-4 space-y-3 lg:col-span-8 lg:mt-0">
            {images.items.map((image) => (
              <li key={image.href} className="max-w-[72ch] text-report-small break-words">
                <a
                  href={image.href}
                  className="inline-flex min-h-11 items-center underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  {image.credit}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </ReportFrame>
  );
}
