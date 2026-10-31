import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { methodUi } from '../../content';
import { accent } from '../../primitives/accent';

// The counts of the text of the part, from the smallest layer to the largest.
const { layers } = methodUi.numbers;
const TONE: Readonly<Record<string, string>> = {
  Fight: accent.bg,
  Finance: 'bg-foreground/55',
  Pay: 'bg-foreground/15',
};
const squares = [...layers]
  .reverse()
  .flatMap((layer) =>
    Array.from({ length: Number(layer.value) }, () => TONE[layer.label] ?? TONE['Pay']),
  );
// The same label as the other art of the report.
const LABEL = 'Illustration. Not evidence of the investigation.';
const SOURCE = `Count of the text of the part, not a map of the nodes. Source: ${methodUi.layers.sources}, ${methodUi.layers.period}.`;

/** The art of the chapter break: one square for each critical node, across the full width behind
 * the numeral, fading into the ground under the title. */
export function NodeField() {
  const reduce = useReducedMotion() === true;
  return (
    <div className="absolute inset-y-0 left-[calc(50%-50cqw)] -z-10 w-[100cqw] overflow-hidden">
      <motion.div
        // Under reduced motion, in print and without the observer, the field shows at once.
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 1.2 }}
        // On a tablet the numeral fills the width, so the field starts under it and stays small.
        className="mx-auto max-w-[1200px] px-4 pt-6 print:opacity-100! md:px-8 md:pt-[calc(min(56vw,26rem)*0.78+3.5rem)] lg:pt-16"
      >
        <div className="font-mono text-report-label text-label lg:ml-auto lg:w-1/2">
          <p>
            {methodUi.numbers.total.value} · {methodUi.field}
          </p>
          <p>{LABEL}</p>
          <p className="normal-case">{SOURCE}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4">
            {layers.map((layer) => (
              <li key={layer.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('size-2.5', TONE[layer.label])} />
                {layer.label} {layer.value}
              </li>
            ))}
          </ul>
        </div>
        <div
          aria-hidden="true"
          className="mt-3 grid grid-cols-[repeat(auto-fill,0.625rem)] gap-1 lg:ml-auto lg:gap-1.5 lg:w-1/2 lg:grid-cols-[repeat(auto-fill,1.125rem)]"
        >
          {squares.map((tone, index) => (
            // The squares never move, so their place is their identity.
            <span key={index} className={cn('aspect-square', tone)} />
          ))}
        </div>
      </motion.div>
      {/* The scrim keeps the title clear of the squares. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-background from-35% via-background/85 via-55% to-transparent md:max-lg:from-30% md:max-lg:via-background/50 md:max-lg:via-40%"
      />
    </div>
  );
}
