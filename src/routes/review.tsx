import { createFileRoute, useNavigate } from '@tanstack/react-router';

import {
  isVariantKey,
  PrototypeSwitcher,
  type VariantKey,
} from '@/features/review/prototype-switcher';
import { ReviewPage } from '@/features/review/review-page';

/**
 * **PROTOTYPE — throwaway.** The route carries the variation switch and nothing else.
 *
 * The composed layout — the narrow queue docked beside the map or the graph — was dropped on
 * 11 August 2026. `ReviewQueueSidebar` is still exported by the feature and is no longer mounted
 * anywhere, so nothing here imports a second feature.
 *
 * ADR 0004 §7 puts identity in the URL, so the subject under examination is a search parameter
 * and not component state.
 */

// Exported because `routeTree.gen.ts` names this type in its own declarations, and a type it
// cannot name fails `tsc` with TS4023 while `vite dev` still runs.
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
    variant: isVariantKey(search['variant']) ? search['variant'] : 'ledger',
    id: typeof search['id'] === 'string' && search['id'] !== '' ? search['id'] : undefined,
  }),
});

function ReviewRoute() {
  const { variant, id } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <>
      <ReviewPage
        variant={variant}
        subjectId={id ?? null}
        onSelect={(subjectId) => {
          void navigate({ search: (prev) => ({ ...prev, id: subjectId }) });
        }}
      />
      <PrototypeSwitcher
        current={variant}
        onChange={(next) => {
          void navigate({ search: (prev) => ({ ...prev, variant: next }) });
        }}
      />
    </>
  );
}
