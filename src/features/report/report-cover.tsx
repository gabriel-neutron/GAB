import { Link } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { report, ui } from './content';
import { ScrambleText } from './scramble-text';

// The build sets this name only when it copied the PDF beside the page, so the link never names
// a file that is absent.
const pdfName: unknown = import.meta.env['VITE_REPORT_PDF'];
const pdfHref =
  typeof pdfName === 'string' && pdfName !== '' ? import.meta.env.BASE_URL + pdfName : null;

const ACTION = cn(
  'inline-flex h-11 items-center gap-2 border px-4 text-body-sm transition-colors duration-150',
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
);

/** The first screen: the title of the research, its two actions, and the cover art with its
 * credit. The art is labelled, so it never reads as evidence. */
export function ReportCover() {
  return (
    <header className="relative">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="py-6 md:py-12 lg:w-1/2 lg:py-24 lg:pr-8">
          <p className="font-mono text-caption uppercase text-label">{report.date}</p>
          <h1 className="mt-3 text-[44px]/[1.05] tracking-[-1.1px] text-balance md:text-display">
            <ScrambleText text={report.title} />
          </h1>
          <p className="mt-3 max-w-[40ch] text-body text-muted-foreground">{report.subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/search"
              className={cn(ACTION, 'border-input text-foreground hover:bg-surface-secondary')}
            >
              {ui.data}
            </Link>
            {pdfHref === null ? null : (
              <a
                href={pdfHref}
                download
                className={cn(
                  ACTION,
                  'border-transparent bg-primary text-primary-foreground hover:bg-primary/85',
                )}
              >
                <Download size={14} aria-hidden="true" />
                {ui.pdf}
              </a>
            )}
          </div>
        </div>
      </div>
      <figure className="relative h-36 md:h-64 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-1/2">
        <img
          src={ui.cover.src}
          alt={ui.cover.alt}
          className="h-full w-full object-none object-[38%_62%]"
          decoding="async"
        />
        <figcaption className="absolute bottom-0 left-0 max-w-full bg-background px-2 py-1 font-mono text-small/4 text-label">
          <span className="block uppercase">{ui.cover.label}</span>
          <a
            href={ui.cover.href}
            className="underline decoration-border underline-offset-2 hover:text-foreground"
          >
            {ui.cover.credit}
          </a>
        </figcaption>
      </figure>
    </header>
  );
}
