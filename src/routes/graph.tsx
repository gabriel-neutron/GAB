import { createFileRoute } from '@tanstack/react-router';
import { GraphPage } from '@/features/graph/graph-page';

export const Route = createFileRoute('/graph')({
  component: GraphPage,
});
