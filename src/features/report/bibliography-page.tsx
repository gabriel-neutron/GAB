import { Link } from '@tanstack/react-router';
import { LanguageSwitch } from './language-switch';
import { noteAnchor } from './note-ref';
import { ReportFrame } from './report-frame';
import { RichText } from './rich-text';
import { useContent, type ReportPath } from './use-content';

/** Every note of the report, grouped by part, each one at the anchor that its marker links to,
 * then the credits of the images of the report page. */
export function BibliographyPage() {
  const { parts, ui, untwinned } = useContent();
  const { images } = ui.bibliography;
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
          {/* The notes keep their ids in both locales, so the switch keeps the note in view. */}
          <LanguageSwitch page="notes" />
        </div>
        <h1 className="mt-6 text-report-heading text-balance ">{ui.bibliography.title}</h1>
        {parts
          .filter((part) => part.notes.length > 0)
          .map((part) => (
            <section
              key={part.slug}
              aria-labelledby={`notes-${part.slug}`}
              className="mt-12 border-t border-border pt-6 lg:grid lg:grid-cols-12 lg:gap-x-8"
            >
              <h2 id={`notes-${part.slug}`} className="text-report-lead text-balance lg:col-span-4">
                {part.title}
              </h2>
              <ol className="mt-4 space-y-3 lg:col-span-8 lg:mt-0">
                {part.notes.map((note) => (
                  <li
                    key={note.id}
                    id={noteAnchor(part.slug, note.id)}
                    className="grid scroll-mt-6 grid-cols-[4rem_minmax(0,1fr)] gap-3 text-report-small target:bg-surface-secondary"
                  >
                    <span className="font-mono text-report-label text-label">{note.id}</span>
                    <span className="max-w-[72ch] break-words">
                      <RichText text={note.text} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        {untwinned.length === 0 ? null : (
          <section
            aria-labelledby="notes-untwinned"
            className="mt-12 border-t border-border pt-6 lg:grid lg:grid-cols-12 lg:gap-x-8"
          >
            <h2 id="notes-untwinned" className="text-report-lead text-balance lg:col-span-4">
              {ui.note.missing}
            </h2>
            {/* No machine translation fills an English note with no French twin: a mark says so. */}
            <ol className="mt-4 space-y-3 lg:col-span-8 lg:mt-0">
              {untwinned.map((id) => (
                <li key={id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 text-report-small">
                  <span className="font-mono text-report-label text-label">{id}</span>
                  <span className="font-mono text-report-label uppercase text-label">
                    {ui.note.noTwin}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <section
          aria-labelledby="notes-images"
          className="mt-12 border-t border-border pt-6 lg:grid lg:grid-cols-12 lg:gap-x-8"
        >
          <h2 id="notes-images" className="text-report-lead text-balance lg:col-span-4">
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
