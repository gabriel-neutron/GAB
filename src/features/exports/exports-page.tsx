import { releaseDay } from '@gab/release/release-day';
import type { SiteRelease } from '@gab/release/site-release';

import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { ReadingPage } from '@/shared/page/reading-page';

import { BudgetShareFigure } from './budget-share-figure';
import { CriticalityMatrix } from './criticality-matrix';
import type { Attachment, ExportsText } from './exports-text';
import type { FigureRow } from './figure-rows';
import { LedgerFigure } from './ledger-figure';
import type { ReportLinks } from './report-links';
import { ReportParagraph } from './report-paragraph';
import { SellerTimelineFigure } from './seller-timeline-figure';
import { documentsOf } from './value-source';

/** The rows of each figure file, or null when the file is not on this site. */
export interface ExportsFigures {
  readonly budget: readonly FigureRow[] | null;
  readonly ledger: readonly FigureRow[] | null;
  readonly sellers: readonly FigureRow[] | null;
}

export interface ExportsPageProps {
  readonly text: ExportsText;
  /** Null when the site holds no release: the matrix and the links come from a release. */
  readonly release: SiteRelease | null;
  readonly figures: ExportsFigures;
  readonly links: ReportLinks;
}

const FIGURES = ['budget', 'ledger', 'sellers'] as const;

/** The exports part of the report. The text comes from the text file, the figures from the data
 * files of the report, and the matrix from the release. A part that has no source says so in one
 * sentence and never draws a guess. */
export function ExportsPage({ text, release, figures, links }: ExportsPageProps) {
  const documents = documentsOf(release);
  const paragraph = (parts: ExportsText['limits']['paragraph'], key: string) => (
    <ReportParagraph key={key} parts={parts} release={release} links={links} />
  );

  const attachment = (kind: Attachment) => {
    if (kind === 'matrix')
      return release === null ? (
        <p className="text-muted-foreground">
          This site holds no release, and the matrix comes from a release.
        </p>
      ) : (
        <CriticalityMatrix release={release} title={text.captions.matrix} links={links} />
      );
    const number = FIGURES.indexOf(kind) + 1;
    const rows = figures[kind];
    if (rows === null)
      return (
        <p className="text-muted-foreground">
          {`The data file of figure ${String(number)} is not on this site.`}
        </p>
      );
    const props = { number, title: text.captions[kind], rows, documents };
    if (kind === 'budget') return <BudgetShareFigure {...props} />;
    return kind === 'ledger' ? <LedgerFigure {...props} /> : <SellerTimelineFigure {...props} />;
  };

  return (
    <ReadingPage wide>
      <div className="publication-layout">
        <aside className="publication-outline">
          <nav aria-label="Chapters of the report">
            {text.blocks.map((block) => (
              <a key={block.id} href={`#${block.id}`}>
                {block.title}
              </a>
            ))}
            <a href="#limites">{text.limits.title}</a>
          </nav>
          <a href="/nodes">Critical nodes ↗</a>
        </aside>
        <article className="publication-document">
          <PageHeader
            title={text.title}
            detail={
              release === null
                ? undefined
                : `From the release of ${releaseDay(release.manifest.date)}`
            }
          />
          {text.blocks.map((block) => (
            <div
              key={block.id}
              className={block.kind === 'box' ? 'border border-border p-3' : undefined}
              data-block={block.kind}
            >
              <PageSection title={block.title} id={block.id}>
                <div
                  className={
                    block.attach === 'budget' || block.attach === 'ledger'
                      ? 'publication-evidence-row'
                      : 'publication-block'
                  }
                >
                  <div className="publication-copy">
                    {block.paragraphs.map((parts, place) =>
                      paragraph(parts, `${block.id}${String(place)}`),
                    )}
                  </div>
                  {block.attach === undefined ? null : (
                    <div className="publication-figure">{attachment(block.attach)}</div>
                  )}
                </div>
              </PageSection>
            </div>
          ))}
          <div>
            <PageSection title={text.limits.title} id="limites">
              {paragraph(text.limits.paragraph, 'limits')}
            </PageSection>
          </div>
        </article>
      </div>
    </ReadingPage>
  );
}
