import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { ReviewPage } from '@/features/review/review-page';

/**
 * **PROTOTYPE — throwaway.**
 *
 * Three layouts were compared here on 11 August 2026. The operator chose the Inspector, so the
 * other two and the variation switcher are gone and `?variant=` no longer exists.
 *
 * ADR 0004 §7 puts identity in the URL, so the subject under examination is a search parameter
 * and not component state.
 */

// Exported because `routeTree.gen.ts` names this type in its own declarations, and a type it
// cannot name fails `tsc` with TS4023 while `vite dev` still runs.
export interface ReviewSearch {
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
    id: typeof search['id'] === 'string' && search['id'] !== '' ? search['id'] : undefined,
  }),
});

function ReviewRoute() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <ReviewPage
      subjectId={id ?? null}
      onSelect={(subjectId) => {
        void navigate({ search: () => ({ id: subjectId }) });
      }}
    />
  );
}
