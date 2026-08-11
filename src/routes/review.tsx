import { createFileRoute, useNavigate } from '@tanstack/react-router';

import {
  isVariantKey,
  PrototypeSwitcher,
  type VariantKey,
} from '@/features/review/prototype-switcher';
import { ReviewPage } from '@/features/review/review-page';
import { ReviewQueueSidebar } from '@/features/review/review-queue-sidebar';

/**
 * **The route carries the prototype switch, and it carries the composition.**
 *
 * ADR 0004 §5 makes `routes/` the only folder that may import a feature, so variant C — the
 * narrow queue docked beside another surface — is assembled here and not inside the feature.
 * The surface beside it is a stand-in, not the map: the map is a feature, and this file is the
 * only place that could ever put the two together.
 *
 * ADR 0004 §7 puts identity in the URL, so the proposal under examination is a search parameter
 * and not component state.
 */

// Exported because `routeTree.gen.ts` names this type in its own declarations, and a type it
// cannot name fails `tsc` with TS4023 while `vite dev` still runs. ADR 0004 records why the
// generated tree is checked at all.
export interface ReviewSearch {
  readonly variant: VariantKey;
  /**
   * Absent, and not null. A `null` here is serialised into the address as the four letters
   * `null`, which the validator then reads back as a valid identifier. `undefined` is dropped
   * from the address instead.
   */
  readonly id?: string | undefined;
}

export const Route = createFileRoute('/review')({
  component: ReviewRoute,
  head: () => ({ meta: [{ title: 'Review · Gabriel' }] }),
  validateSearch: (search: Record<string, unknown>): ReviewSearch => ({
    variant: isVariantKey(search['variant']) ? search['variant'] : 'A',
    id: typeof search['id'] === 'string' && search['id'] !== '' ? search['id'] : undefined,
  }),
});

function ReviewRoute() {
  const { variant, id } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setVariant = (next: VariantKey): void => {
    void navigate({ search: (prev) => ({ ...prev, variant: next }) });
  };
  const select = (proposalId: string): void => {
    void navigate({ search: (prev) => ({ ...prev, id: proposalId }) });
  };

  return (
    <>
      {variant === 'C' ? (
        <ComposedLayout selectedId={id ?? null} onSelect={select} />
      ) : (
        <ReviewPage subjectId={id ?? null} onSelect={select} />
      )}
      <PrototypeSwitcher current={variant} onChange={setVariant} />
    </>
  );
}

/**
 * Layout C. The question ADR 0004 §6 deferred: does the queue work as a rail beside a view that
 * fills the screen, or does it need a page of its own?
 */
function ComposedLayout({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (proposalId: string) => void;
}) {
  return (
    <div className="flex h-[calc(100svh-9rem)] overflow-hidden rounded-lg border border-border">
      <ReviewQueueSidebar selectedId={selectedId ?? undefined} onSelect={onSelect} />
      <div className="flex flex-1 items-center justify-center bg-[repeating-linear-gradient(45deg,var(--color-muted)_0_10px,transparent_10px_20px)]">
        <p className="max-w-xs rounded-lg bg-background p-4 text-sm text-muted-foreground">
          The map or the graph fills this. Neither is imported: a feature never imports a feature,
          and only this route file may compose two.
        </p>
      </div>
    </div>
  );
}
