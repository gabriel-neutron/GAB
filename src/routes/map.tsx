import { createFileRoute } from '@tanstack/react-router';
import { MapPage } from '@/features/map/map-page';

export const Route = createFileRoute('/map')({
  component: MapPage,
  head: () => ({ meta: [{ title: 'Map · Gabriel' }] }),
});
