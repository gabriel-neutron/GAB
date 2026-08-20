import { createFileRoute, notFound } from '@tanstack/react-router';
import { DetailPage } from '@/features/detail/detail-page';
import { readDossier } from '@/features/detail/dossier';
import { corpus } from '@/shared/fixtures/corpus';
import type { DocId } from '@/shared/fixtures/types';

/**
 * The route of the full entity page.
 *
 * `$id` is an opaque string. No schema is settled, so this file decides nothing
 * about the form of an identifier — no length, no character set, no prefix.
 *
 * The one case it does answer is a segment that is blank once trimmed. A blank string names no
 * entity under any schema, so rejecting it settles nothing. Every other identifier reaches the
 * read, and an answer of `null` raises the same not-found.
 *
 * The words of `EntityNotFound` are not the words of an unknown path. An unknown identifier is
 * usually a stale link to a withdrawn document, and a fuzzy match would hide that.
 *
 * **The fixture is imported here, in the route.** A derivation takes the read as an argument
 * and imports no read module, so on the day `src/contract/` replaces `src/shared/fixtures/`
 * only this one line changes.
 */

/**
 * The address of this route, validated at the edge.
 *
 * `?src=` opens the page at one card of the rail, and it is **not** scaffolding. `?surface=` was
 * scaffolding of the prototype, it was left behind, and this route reads it nowhere.
 */
export interface EntitySearch {
  /** The document the reader arrived at. `null` is the normal arrival. */
  readonly src: DocId | null;
}

/**
 * The answer of the loader when the corpus holds no such entity.
 *
 * `notFound({ throw: true })` is the documented alternative to `throw notFound()`. It is used
 * because the value that TanStack Router raises is not an `Error`, and this repository keeps
 * `only-throw-error` on with no exception. Its declared return type is `NotFoundError` and not
 * `never`, so no value narrows after the call. This wrapper states `never` once, and the line
 * after the call never runs.
 */
function entityNotFound(): never {
  notFound({ throw: true });
  throw new Error('The router did not raise the not-found answer.');
}

export const Route = createFileRoute('/entity/$id')({
  // The address comes from outside, so it is validated before its first use. It falls back and
  // it never throws: a stale or a malformed `?src=` opens the page at no card, which is the
  // normal arrival, and it must never take the whole entity off the screen.
  validateSearch: (search: Record<string, unknown>): EntitySearch => {
    const src = search['src'];
    return { src: typeof src === 'string' && src.trim() !== '' ? src : null };
  },

  loader: ({ params }) => {
    if (params.id.trim() === '') entityNotFound();
    // This is the read. `readDossier` takes the corpus as an argument, so the day the read
    // layer exists the argument changes and the derivation does not.
    return readDossier(corpus, params.id) ?? entityNotFound();
  },

  component: EntityRoute,
  notFoundComponent: EntityNotFound,

  // The identifier is in the title. Four routes that all report "Gabriel" tell a screen reader
  // nothing, and an entity page is the one route where the name changes on every visit.
  head: ({ params }) => ({ meta: [{ title: `Entity ${params.id} · Gabriel` }] }),
});

/** The boundary: it reads the address, calls one feature function and draws the result. */
function EntityRoute() {
  const { id } = Route.useParams();
  const { src } = Route.useSearch();
  const dossier = Route.useLoaderData();

  // **The defect this key exists to not repeat.** Every control is read-only, so each
  // one draws its value with `defaultValue`, and React reads that once. A move from one entity
  // to another keeps the same route and the same mounted page, so React reconciled the record
  // and a field kept the previous entity's value under the correct label.
  return <DetailPage key={id} dossier={dossier} arrivedAtSource={src} />;
}

function EntityNotFound() {
  return (
    <p>
      No entity carries this identifier. The document that held it may have been withdrawn, so the
      link that brought you here may be stale.
    </p>
  );
}
