import { pairRating, type SiteRelease } from '@gab/release/site-release';

import { ClaimLink } from '@/shared/page/claim-link';
import { READING_LINK } from '@/shared/page/reading-link';

import type { Paragraph } from './exports-text';
import type { ReportLinks } from './report-links';

export interface ReportParagraphProps {
  readonly parts: Paragraph;
  readonly release: SiteRelease | null;
  readonly links: ReportLinks;
}

/** A paragraph of the report. Each company, vessel or act that the release holds links to its
 * page, and each claim that the release holds links to its page with its ADMIRALTY pair. A
 * mention that the release does not hold stays text, so the link never leads to nothing. */
export function ReportParagraph({ parts, release, links }: ReportParagraphProps) {
  return (
    <p className="max-w-[64ch]">
      {parts.map((part, place) => {
        if (typeof part === 'string') return part;
        if ('entity' in part)
          return release?.entityById.has(part.entity) ? (
            <a
              key={`${part.entity}:${String(place)}`}
              className={READING_LINK}
              href={links.entity(part.entity)}
            >
              {part.label}
            </a>
          ) : (
            part.label
          );
        const claim = release?.claimById.get(part.claim);
        return release === null || claim === undefined ? (
          part.text
        ) : (
          <ClaimLink
            key={`${part.claim}:${String(place)}`}
            text={part.text}
            href={links.claim(part.claim)}
            rating={pairRating(release.manifest, claim)}
          />
        );
      })}
    </p>
  );
}
