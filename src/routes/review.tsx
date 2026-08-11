import { createFileRoute } from '@tanstack/react-router';
import { ReviewPage } from '@/features/review/review-page';

export const Route = createFileRoute('/review')({
  component: ReviewPage,
  head: () => ({ meta: [{ title: 'Review · Gabriel' }] }),
});
