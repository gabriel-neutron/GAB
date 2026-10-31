import { useSyncExternalStore, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { fightUi, type ReportBlock } from '../../content';
import { NodeRef } from '../../node-ref';
import { StickyScene } from '../../primitives/sticky-scene';
import { RichText } from '../../rich-text';
import {
  arcChains,
  arcs,
  brands,
  chainCount,
  routeCounts,
  sites,
  stages,
  totalsAt,
  type Place,
} from './chain-data';
import { ChainMap } from './chain-map';
import { ChainStrips, ChainTotals } from './chain-panels';

const copy = fightUi.chain;
const STEPS = stages.length + 2;
const ROUTES = stages.length;
const BUYERS = stages.length + 1;
const pad = (n: number) => String(n).padStart(2, '0');
// shortcut: these two lines live here, not in content.ts, because content.ts is in another pull request.
const ARC_NOTE =
  'Map: arcs join the country of manufacture to the country of the intermediary. Chains with the same country or no named country are not drawn: the arcs carry {drawn} of the {all} chains.';
const UNPLACED = 'Map: a group with no single place is not drawn.';

// External constraint: a media query is the one way to read the width of the screen. 1024px is the
// `lg` break of the stylesheet, where the map gets its own column beside the text.
const WIDE = '(min-width: 1024px)';
const onWidth = (listener: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
};
const isWide = () => window.matchMedia(WIDE).matches;
// The render at the release has no screen, so it draws the static rows.
const atRelease = () => false;

const unique = (list: readonly Place[], bare: boolean): Place[] => {
  const seen = new Map<string, Place>();
  for (const place of list)
    if (!seen.has(place.name)) seen.set(place.name, bare ? { ...place, value: undefined } : place);
  return [...seen.values()];
};
const routePlaces = unique(
  arcs.flatMap((arc) => [arc.from, arc.to]),
  false,
);
// The accent places first: the label placer gives the room to the first labels.
const byTone = (list: readonly Place[]) =>
  [...list].sort((a, b) => Number(b.tone === 'accent') - Number(a.tone === 'accent'));

/** The map of one step: its labelled places, its crop, and whether its routes are lit. */
function StepMap({ step }: { readonly step: number }) {
  if (step === BUYERS) return <ChainMap crop="russia" places={[]} arcs={[]} lit sites={sites} />;
  const routes = step === ROUTES;
  const places = routes ? routePlaces : (stages[step]?.places ?? []);
  // Only the routes step draws arcs: the other steps give shares by place, not routes of goods.
  return (
    <ChainMap
      crop="world"
      places={byTone(places)}
      arcs={routes ? arcs : []}
      lit={routes}
      sites={[]}
    />
  );
}

/** The fixed figure of the scene: the map over the strips of the three stages. On a phone it is
 * a compact opaque band at the top of the view, over the cards, with a fade at its lower edge. On
 * a wide screen it fills the view right of the cards, inside the text grid of the page. */
function Scene({ step }: { readonly step: number }) {
  return (
    <div className="flex h-[var(--report-view,100svh)] flex-col lg:grid lg:grid-cols-[28rem_minmax(0,1fr)] lg:gap-10">
      <div aria-hidden="true" className="hidden lg:block" />
      <div className="pointer-events-auto relative flex min-w-0 flex-col gap-3 border-b border-divider bg-background pt-2 pb-3 lg:gap-6 lg:border-0 lg:bg-transparent lg:py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-10 bg-linear-to-b from-background to-transparent lg:hidden"
        />
        <div className="relative h-60 sm:aspect-[2/1] sm:h-auto sm:max-h-[40svh] lg:aspect-auto lg:max-h-none lg:min-h-0 lg:flex-1">
          <StepMap step={step} />
        </div>
        <div className="lg:max-w-[44rem]">
          <ChainStrips active={step} />
        </div>
      </div>
    </div>
  );
}

/** A source of one step: the citation a reader can follow, then the record of the database. */
function KseSource({ page }: { readonly page: string }) {
  return (
    <div className="mt-6 border-t border-divider pt-2">
      <p className="font-mono text-caption uppercase text-label">{copy.source}</p>
      <p className="mt-1 text-body-sm text-muted-foreground">
        <a
          href={copy.kse.url}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-divider underline-offset-4 hover:text-foreground"
        >
          {copy.kse.text}
        </a>
        , {copy.page} {page}
      </p>
    </div>
  );
}

const Record = ({ id }: { readonly id: string }) => (
  <p className="mt-1 font-mono text-data text-label">
    {copy.record} {id}
  </p>
);

const Head = ({ index, title }: { readonly index: number; readonly title: string }) => (
  <>
    <p className="font-mono text-caption uppercase tabular-nums text-label">
      {copy.step} <span className="text-signal">{pad(index + 1)}</span> / {pad(STEPS)}
    </p>
    <h4 className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)]/[1.05] tracking-[-0.03em] text-balance">
      {title}
    </h4>
  </>
);

const Figure = ({ value, label }: { readonly value: string; readonly label: string }) => (
  <div className="mt-5">
    <p className="font-mono text-[clamp(3rem,7vw,4.5rem)]/[0.85] tracking-[-0.05em] text-signal tabular-nums">
      {value}
    </p>
    <p className="mt-2 font-mono text-caption uppercase text-label">{label}</p>
  </div>
);

/** The text of the steps, one for each step, each with its own source. */
function cards(figure: ReportBlock['figure'], text: string, partSlug: string): ReactNode[] {
  // The note marks of the figure block, so that a renumbered note follows the text.
  const marks = (text.match(/\[\^[^\]]+\]/g) ?? []).join('');
  const routeSource = (
    <div className="mt-6 border-t border-divider pt-2">
      <p className="font-mono text-caption uppercase text-label">{copy.source}</p>
      <p className="mt-1 text-body-sm text-muted-foreground">
        <RichText text={`${figure?.sources ?? ''}${marks}`} partSlug={partSlug} />
      </p>
    </div>
  );
  const top = totalsAt(1)[0];
  return [
    ...stages.map((stage, index) => (
      <div key={stage.name}>
        <Head index={index} title={stage.name} />
        <p className="mt-3 text-body-sm text-muted-foreground">{copy.imports}</p>
        <dl className="mt-5 grid border-t border-divider">
          {stage.shares.map((share) => (
            <div
              key={share.group}
              className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-divider py-1.5"
            >
              <dt className="text-body-sm">{share.group}</dt>
              <dd className="text-right font-mono text-data tabular-nums">{share.text}%</dd>
              {share.note === '' ? null : (
                <dd className="col-span-2 font-mono text-data text-pretty text-label">
                  {share.note}
                </dd>
              )}
            </div>
          ))}
        </dl>
        <p className="mt-2 font-mono text-data text-label">{UNPLACED}</p>
        {index === 0 ? (
          <div className="mt-4">
            <p className="font-mono text-caption uppercase text-label">{copy.brands}</p>
            <ul className="mt-1 grid gap-0.5 font-mono text-data">
              {brands.map((brand) => (
                <li key={brand.name} className="flex justify-between gap-3">
                  <span>{brand.name}</span>
                  <span className="tabular-nums">{brand.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <KseSource page={stage.page} />
        <Record id={stage.document} />
      </div>
    )),
    <div key="routes">
      <Head index={ROUTES} title={copy.routesTitle} />
      <p className="mt-3 text-body-sm text-muted-foreground">{copy.routesText}</p>
      <Figure
        value={String(routeCounts.doc)}
        label={copy.documentedLabel.replace('{steps}', String(routeCounts.steps))}
      />
      <p className="mt-4 font-mono text-data text-label">{copy.states}</p>
      <p className="mt-2 font-mono text-data text-label">
        {ARC_NOTE.replace('{drawn}', chainCount(arcChains.drawn)).replace(
          '{all}',
          chainCount(arcChains.all),
        )}
      </p>
      <div className="mt-6">
        <ChainTotals title={copy.byIntermediary} totals={totalsAt(0)} />
      </div>
      {routeSource}
    </div>,
    <div key="buyers">
      <Head index={BUYERS} title={copy.buyersTitle} />
      <p className="mt-3 text-body-sm text-muted-foreground">{copy.buyersText}</p>
      {top === undefined ? null : (
        <Figure
          value={chainCount(top.chains)}
          label={copy.throughLabel
            .replace('{chains}', String(routeCounts.chains))
            .replace('{name}', top.name)}
        />
      )}
      <div className="mt-6 grid gap-6">
        <ChainTotals title={copy.byBuyer} totals={totalsAt(1)} />
        <ChainTotals title={copy.byUse} totals={totalsAt(2)} />
      </div>
      <p className="mt-6 font-mono text-caption uppercase text-label">
        <span
          aria-hidden="true"
          className="mr-2 inline-block size-2.5 rotate-45 border border-signal bg-background"
        />
        {copy.sites} · {copy.siteCount.replace('{n}', String(sites.length))}
      </p>
      {/* The orange number is the key of the map, so the list hides the type glyph. */}
      <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]/5 [&_button>svg]:hidden">
        {sites.map((site, index) => (
          <li key={site.id} className="flex gap-2">
            <span className="font-mono text-data text-signal tabular-nums">{pad(index + 1)}</span>
            <NodeRef id={site.id} />
          </li>
        ))}
      </ol>
      {routeSource}
    </div>,
  ];
}

/** The chain story: from the brand of a component to the weapon, one step for each scroll card.
 * The map and the chart follow the step in view. Under reduced motion, and under 1024px where a
 * fixed map would cover the cards, each step shows as a static row: its text on the left, its own
 * map and strips on the right (on a phone and a tablet, above the text). */
export function ChainStory({
  figure,
  text,
  partSlug,
}: {
  readonly figure: ReportBlock['figure'];
  /** The text of the figure block, which holds its note marks. */
  readonly text: string;
  readonly partSlug: string;
}) {
  const reduce = useReducedMotion();
  const wide = useSyncExternalStore(onWidth, isWide, atRelease);
  const steps = cards(figure, text, partSlug);
  return (
    <section
      aria-labelledby="fight-chain-title"
      id="fight-chain"
      className="mt-28 mb-16 scroll-mt-[calc(var(--report-bar,0px)+3rem)] border-t border-foreground pt-3"
    >
      <p className="font-mono text-caption uppercase text-label">{copy.kicker}</p>
      <h3
        id="fight-chain-title"
        className="mt-2 text-[clamp(2.5rem,7vw,5.5rem)]/[0.95] tracking-[-0.045em] text-balance"
      >
        {copy.title}
      </h3>
      <p className="mt-4 max-w-[60ch] text-body-sm text-muted-foreground">{copy.intro}</p>
      <div className="mt-8">
        {reduce === true || !wide ? (
          <ol className="grid gap-16">
            {steps.map((step, index) => (
              <li
                key={`card-${String(index)}`}
                className="grid gap-6 border-t border-foreground pt-4 lg:grid-cols-[28rem_minmax(0,1fr)] lg:gap-10"
              >
                <div className="grid content-start gap-4 lg:order-last lg:gap-6">
                  <div className="relative h-60 sm:aspect-[2/1] sm:h-auto sm:max-h-[40svh] lg:aspect-auto lg:h-[26rem] lg:max-h-none">
                    <StepMap step={index} />
                  </div>
                  <ChainStrips active={index} />
                </div>
                <div className="min-w-0 text-body">{step}</div>
              </li>
            ))}
          </ol>
        ) : (
          <StickyScene
            steps={steps}
            tail={false}
            sceneClassName="pointer-events-none z-10"
            stepClassName={cn(
              'w-full border-t border-foreground bg-background pt-4 pb-8 text-body',
              'lg:max-w-[28rem] lg:border-0 lg:bg-transparent lg:pt-0',
            )}
          >
            {(active) => <Scene step={active} />}
          </StickyScene>
        )}
      </div>
    </section>
  );
}
