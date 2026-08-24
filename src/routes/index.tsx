import { createFileRoute, redirect } from '@tanstack/react-router';

// `redirect({ throw: true })` is the documented alternative to `throw redirect()`, used because
// the value TanStack Router raises is a `Response` and not an `Error`, and `only-throw-error`
// stays on. Its return type is `Redirect` and not `never`, so this wrapper states `never` once.
function toTheMap(): never {
  redirect({ to: '/map', search: { entity: '', relation: '' }, replace: true, throw: true });
  throw new Error('The router did not raise the redirect.');
}

// The map is the ground the analyst works over, so it is what an empty address opens. The root
// carries no surface of its own: a landing page between the address and the work is one more
// press on every visit, and it holds nothing the navigation bar above does not already state.
export const Route = createFileRoute('/')({
  beforeLoad: toTheMap,
});
