import { createFileRoute } from '@tanstack/react-router';

import { ReviewDecided } from '@/features/review/review-decided';

/**
 * **PROTOTYPE — throwaway.** The record of what was decided.
 *
 * The trailing underscore of `review_` makes this a route beside `/review` and not a child of
 * it, so `/review` needs no `Outlet` and stays a page that fills the screen — ADR 0004 §6.
 *
 * **A fifth route is not settled here.** ADR 0004 §6 names four, and the layout is deferred to
 * this prototype. The report says what the split costs and what it buys.
 */
export const Route = createFileRoute('/review_/decided')({
  component: ReviewDecided,
  head: () => ({ meta: [{ title: 'Decided · Gabriel' }] }),
});
