import { parts, ui, type ReportPart } from '../content';
import { Blocks } from '../blocks';
import { NodeStrip } from '../node-strip';
import { ScrambleText } from '../scramble-text';

/** The default drawing of one part: its chapter head, the nodes it names and its text. */
export function PartDefault({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  return (
    <section
      id={part.slug}
      aria-labelledby={`${part.slug}-title`}
      className="scroll-mt-4 border-t border-border pt-6 pb-16 lg:grid lg:grid-cols-12 lg:gap-x-8"
    >
      <header className="lg:col-span-4">
        <div className="lg:sticky lg:top-6">
          <p className="font-mono text-report-label uppercase text-label">
            {ui.part.number} <span className="tabular-nums">{number}</span>
          </p>
          <h2 id={`${part.slug}-title`} className="mt-3 text-report-heading text-balance ">
            <ScrambleText text={part.title} />
          </h2>
          <NodeStrip nodeIds={part.nodeIds} />
        </div>
      </header>
      <div className="mt-8 min-w-0 text-report-small lg:col-span-8 lg:mt-0">
        <Blocks blocks={part.blocks} partSlug={part.slug} />
      </div>
    </section>
  );
}
