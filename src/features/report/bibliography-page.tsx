import { Link } from '@tanstack/react-router';
import { parts, ui } from './content';
import { noteAnchor } from './note-ref';
import { ReportFrame } from './report-frame';
import { RichText } from './rich-text';

/** Every note of the report, grouped by part, each one at the anchor that its marker links to. */
export function BibliographyPage() {
  return (
    <ReportFrame label={ui.bibliography.label}>
      <article className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center text-body-sm underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {ui.bibliography.back}
        </Link>
        <h1 className="mt-6 text-heading text-balance md:text-heading-lg">
          {ui.bibliography.title}
        </h1>
        {parts
          .filter((part) => part.notes.length > 0)
          .map((part) => (
            <section
              key={part.slug}
              aria-labelledby={`notes-${part.slug}`}
              className="mt-12 border-t border-border pt-6 lg:grid lg:grid-cols-12 lg:gap-x-8"
            >
              <h2 id={`notes-${part.slug}`} className="text-heading-sm text-balance lg:col-span-4">
                {part.title}
              </h2>
              <ol className="mt-4 space-y-3 lg:col-span-8 lg:mt-0">
                {part.notes.map((note) => (
                  <li
                    key={note.id}
                    id={noteAnchor(part.slug, note.id)}
                    className="grid scroll-mt-6 grid-cols-[4rem_minmax(0,1fr)] gap-3 text-body-sm target:bg-surface-secondary"
                  >
                    <span className="font-mono text-data text-label">{note.id}</span>
                    <span className="max-w-[72ch] break-words">
                      <RichText text={note.text} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
      </article>
    </ReportFrame>
  );
}
