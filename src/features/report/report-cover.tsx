import { Link } from '@tanstack/react-router';
import { cn } from '@/shared/lib/utils';
import { openingUi, report, ui } from './content';
import { NoteRef } from './note-ref';
import { accent } from './primitives/accent';
import { monoLabel, monoNote } from './primitives/label';
import { NumberRoll } from './primitives/number-roll';
import { ScrambleText } from './scramble-text';

// The build sets this name only when it copied the PDF beside the page, so the link never names
// a file that is absent.
const pdfName: unknown = import.meta.env['VITE_REPORT_PDF'];
const pdfHref =
  typeof pdfName === 'string' && pdfName !== '' ? import.meta.env.BASE_URL + pdfName : null;

// The actions of the first screen: 44px boxes. The first one reads the report, so it is solid.
const ACTION = cn(
  'inline-flex min-h-11 items-center gap-2 border px-3 font-mono text-report-label tracking-[0.06em] uppercase md:px-4  md:tracking-[0.08em]',
  'transition-colors duration-150',
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
);
const PRIMARY = cn(
  ACTION,
  'border-foreground bg-foreground text-background hover:bg-signal hover:border-signal',
);
const SECONDARY = cn(
  ACTION,
  'border-foreground/40 bg-background/60 text-foreground hover:border-signal',
);

// A fixed film grain: fractal noise in an inline SVG.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.4 -0.2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

const { coverNumber, links } = openingUi;

/** The first screen, in the theme of the page. The dithered tanker, black on the accent, fills
 * the screen behind the words, and a scrim keeps every word on the plain ground of the page. The key
 * value of the summary sits in the first view, on a solid plate on a wide screen. The label and
 * credit of the art are a caption line under the kicker. */
export function ReportCover() {
  return (
    <header className="relative isolate overflow-hidden border-b border-border bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-signal">
        {/* On a phone the coarse dither aliases into noise, so the photograph shows in the same
            two tones, raised so that the ship shows above the words. */}
        <picture>
          <source media="(min-width: 768px)" srcSet={openingUi.cover.src} />
          <img
            src={openingUi.cover.photo}
            alt={openingUi.cover.alt}
            decoding="async"
            fetchPriority="high"
            className="absolute -top-28 h-[14rem] w-full object-cover object-[14%_50%] mix-blend-multiply grayscale contrast-125 md:static md:h-full md:object-[60%_40%] md:grayscale-0 md:contrast-100 lg:object-[50%_64%] lg:[image-rendering:pixelated]"
          />
        </picture>
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: GRAIN }}
        />
        {/* The scrim. On a phone the art is a band above the words, on the plain ground. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background/0 from-40% to-background md:hidden"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-24 bottom-0 bg-background md:hidden"
        />
        {/* From below on a tablet, from the left on a wide screen. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-linear-to-t md:block from-background from-50% via-background/80 via-70% to-background/0 lg:bg-linear-to-r lg:from-35% lg:via-background/75 lg:via-60%"
        />
      </div>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col justify-end px-4 pt-24 pb-3 md:px-8 md:pt-[30svh] md:pb-10 lg:min-h-[var(--report-view,100svh)] lg:px-12 lg:pt-28 lg:pb-12">
        <p className={monoLabel}>
          <span>{report.date}</span>
          <span aria-hidden="true"> · </span>
          <span>{openingUi.kicker}</span>
        </p>
        {/* The label and credit of the art, a caption line under the kicker, clear of the art. */}
        <p className="mt-2 max-w-[60ch] font-mono text-report-label/[1.4] text-label ">
          <span className=" text-foreground">{ui.cover.label}</span>{' '}
          <a
            href={ui.cover.href}
            className="underline decoration-border underline-offset-2 hover:text-foreground"
          >
            {ui.cover.credit}
          </a>
        </p>
        <h1 className="mt-3 max-w-[14ch] text-report-display leading-[0.92] tracking-[-0.05em] text-balance md:mt-4">
          <ScrambleText text={report.title} />
        </h1>
        <div className="mt-3 grid gap-4 md:mt-6 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12">
          <div>
            <p className="max-w-[52ch] text-report-body/[1.45] text-foreground/80 ">
              {report.deck}
            </p>
            <nav
              aria-label={links.label}
              className="mt-3 flex flex-wrap items-center gap-2 md:mt-6"
            >
              <a href="#summary" className={PRIMARY}>
                {links.read} <span aria-hidden="true">↓</span>
              </a>
              <Link to="/search" className={SECONDARY}>
                {links.data} <span aria-hidden="true">→</span>
              </Link>
              {pdfHref === null ? null : (
                <a href={pdfHref} download className={SECONDARY}>
                  {links.pdf} <span aria-hidden="true">↓</span>
                </a>
              )}
            </nav>
          </div>
          {/* The value and its label on the plain ground, never on the bare art. */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-4 border-t border-border pt-3 lg:max-w-[30rem] lg:grid-cols-1 lg:gap-3 lg:border lg:bg-background lg:p-6">
            <p
              className={cn(
                'text-report-display leading-[0.8]  tracking-[-0.06em] tabular-nums lg:order-2 ',
                accent.text,
              )}
            >
              <NumberRoll value={coverNumber.value} />
            </p>
            <p className={cn('max-w-[30ch] pb-1 lg:order-1 lg:max-w-none', monoNote)}>
              {coverNumber.label}
              <NoteRef partSlug="summary" id={coverNumber.note} />
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
