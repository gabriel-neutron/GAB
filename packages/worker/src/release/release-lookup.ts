import { rowLicence, type RowLicence } from './licence.ts';
import type {
  ReleaseDocument,
  ReleaseEntity,
  ReleaseRecord,
  ReleaseRelation,
} from './release-record.ts';

/** The reads that each file of a release makes in the record. */
export interface ReleaseLookup {
  readonly documentOf: (id: string) => ReleaseDocument;
  /** The licence of a row from the identifiers of its public documents. */
  readonly licenceOf: (sources: readonly string[]) => RowLicence;
  readonly entityOf: (id: string) => ReleaseEntity;
  /** The label of an entity. */
  readonly labelOf: (id: string) => string;
  readonly relationOf: (id: string) => ReleaseRelation;
}

// A row that names what the release does not hold is a fault of the read, and a file with an
// empty field in its place would hide it.
const held = <T>(found: T | undefined, what: string): T => {
  if (found === undefined) throw new Error(`the release does not hold the ${what}`);
  return found;
};

/** The reads of a record. Each read stops the export when the record does not hold the
 * element that it names. */
export const releaseLookup = (record: ReleaseRecord): ReleaseLookup => {
  const documentOf = (id: string): ReleaseDocument =>
    held(record.documents.get(id), `document ${id}`);
  const entities = new Map(record.entities.map((one) => [one.id, one]));
  const entityOf = (id: string): ReleaseEntity => held(entities.get(id), `element ${id}`);
  const relations = new Map(record.relations.map((one) => [one.id, one]));
  return {
    documentOf,
    licenceOf: (sources) => rowLicence(sources.map((id) => documentOf(id).licence)),
    entityOf,
    labelOf: (id) => entityOf(id).label,
    relationOf: (id) => held(relations.get(id), `relation ${id}`),
  };
};
