import { Link } from '@tanstack/react-router';
import type { SiteManifest } from '@gab/release/site-manifest';

import { DisclaimerText } from '@/shared/page/disclaimer-text';
import { KeyValue, type KeyValueEntry } from '@/shared/page/key-value';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';
import { safeHref } from '@gab/release/safe-href';
import { typeLabel } from '@/shared/type-label';

export interface MethodPageProps {
  /** Null when the site holds no release: the page carries the data of a release. */
  readonly manifest: SiteManifest | null;
}

const PROSE = 'max-w-[64ch] text-body';

const SECTIONS = [
  { id: 'dataset', title: 'What the dataset is' },
  { id: 'labels', title: 'What the labels mean' },
  { id: 'errors', title: 'Report an error' },
  { id: 'licence', title: 'Licence and citation' },
] as const;

const LICENCES = [
  { name: 'CC-BY 4.0', meaning: 'Reuse it and give credit.' },
  { name: 'CC-BY-NC 4.0', meaning: 'Reuse it and give credit. Do not use it for commercial work.' },
  {
    name: 'derived fact; source under the provider licence, not redistributed',
    meaning: 'GAB read a fact in a source. The release does not give the source data again.',
  },
] as const;

function Contact({ address }: { readonly address: string }) {
  const href = safeHref(address);
  const shown = address.replace(/^mailto:/u, '');
  return href === null ? (
    <span className="break-all">{shown}</span>
  ) : (
    <a href={href} className={`${READING_LINK} break-all`}>
      {shown}
    </a>
  );
}

/** The About page: what the dataset is, what its labels mean, how to report an error, and the
 * licence with the way to cite it. Every count, date and address comes from the release. */
export function MethodPage({ manifest }: MethodPageProps) {
  if (manifest === null)
    return (
      <ReadingPage>
        <PageHeader title="About" />
        <p className="text-muted-foreground">
          This site holds no release, and the About page comes with a release.
        </p>
      </ReadingPage>
    );
  const { coverage } = manifest;
  const facts: KeyValueEntry[] = [
    { key: 'Release', value: manifest.version, figure: true },
    { key: 'Date', value: manifest.date, figure: true },
    ...(coverage === null
      ? []
      : ([
          { key: 'Entities', value: String(coverage.entities), figure: true },
          { key: 'Sources', value: String(coverage.sources), figure: true },
        ] satisfies KeyValueEntry[])),
  ];
  return (
    <ReadingPage grid>
      <PageHeader
        title="About"
        detail="What this dataset holds, what its labels mean, and how to use and cite it."
      />
      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-4 lg:self-start">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col">
            {SECTIONS.filter((one) => one.id !== 'dataset' || coverage !== null).map((one) => (
              <li key={one.id}>
                <a href={`#${one.id}`} className={READING_LINK}>
                  {one.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="border-b border-border pb-4">
            <KeyValue entries={facts} />
          </div>

          {coverage === null ? null : (
            <PageSection id="dataset" title="What the dataset is">
              <div className={`${PROSE} flex flex-col gap-2`}>
                <p>{coverage.scope.covers}</p>
                <p>{coverage.scope.excludes}</p>
                <p className="">{coverage.scope.absence}</p>
                {coverage.byType.length === 0 ? null : (
                  <p className="text-label">
                    By type:{' '}
                    {coverage.byType.map((one) => `${one.count} ${typeLabel(one.type)}`).join(', ')}
                    .
                  </p>
                )}
              </div>
            </PageSection>
          )}

          <PageSection id="labels" title="What the labels mean">
            <DisclaimerText markdown={manifest.disclaimer} withoutContacts />
            <p className={PROSE}>
              The{' '}
              <Link to="/glossary" className={READING_LINK}>
                glossary
              </Link>{' '}
              explains the other terms and the types of relation.
            </p>
          </PageSection>

          <PageSection id="errors" title="Report an error">
            <p className={PROSE}>
              Use the first address for a mistake in the data. If the record names you, use the
              second address to reply.
            </p>
            <KeyValue
              entries={[
                {
                  key: 'Report an error',
                  value: <Contact address={manifest.contacts.reportError} />,
                },
                {
                  key: 'Right of reply',
                  value: <Contact address={manifest.contacts.rightOfReply} />,
                },
              ]}
            />
          </PageSection>

          <PageSection id="licence" title="Licence and citation">
            <p className={PROSE}>
              The dataset is under CC-BY 4.0. Each row shows its own licence. The row takes the most
              open licence of its public documents:
            </p>
            <ul className={`${PROSE} flex list-disc flex-col gap-1 pl-4`}>
              {LICENCES.map((one) => (
                <li key={one.name}>
                  <strong className="font-normal">{one.name}.</strong> {one.meaning}
                </li>
              ))}
            </ul>
            <p className={PROSE}>To cite the dataset, use this line:</p>
            <p
              className={`${PROSE} border-l-2 border-border pl-3 font-mono break-words`}
              data-citation=""
            >
              GAB dataset, release {manifest.version}, {manifest.date}. {manifest.iriBase}
            </p>
            <p className={PROSE}>
              Each entity and each claim has a permanent address under that base, the same
              identifier as in the linked data file.
            </p>
          </PageSection>
        </div>
      </div>
    </ReadingPage>
  );
}
