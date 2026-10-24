import {
  readDossier,
  readRelation,
  type Dossier,
  type RelationDossier,
} from '@/features/detail/dossier';
import type { ArcInfo, ExitInfo, GlobeData } from '@/features/globe/globe-data';
import type { Target } from '@/features/globe/globe-store';
import type { Corpus, TypeVocabulary } from '@/shared/read/model';

/** The card the map gives for one target. The entity and the relation are the cards of the graph. */
export type MapCard =
  | { readonly kind: 'entity'; readonly dossier: Dossier }
  | { readonly kind: 'relation'; readonly relation: RelationDossier }
  | { readonly kind: 'arc'; readonly arc: ArcInfo }
  | { readonly kind: 'exit'; readonly exit: ExitInfo }
  | { readonly kind: 'no-read' }
  | { readonly kind: 'no-record' }
  | { readonly kind: 'none' };

/** The read of the record behind the map. Null when the read did not load. */
export interface MapRead {
  readonly corpus: Corpus;
  readonly types: TypeVocabulary;
}

/** An exit point is computed by the release and is no record, so it keeps its own card. A link
 * that is a relation of the record opens the panel of the relation, and another link keeps its
 * own card. */
export function mapCard(target: Target, data: GlobeData, read: MapRead | null): MapCard {
  if (target.kind === 'exit') {
    const exit = data.exitInfo[target.id];
    return exit === undefined ? { kind: 'none' } : { kind: 'exit', exit };
  }
  if (target.kind === 'arc') {
    const relation = read === null ? null : readRelation(read.corpus, target.id);
    if (relation !== null) return { kind: 'relation', relation };
    const arc = data.arcInfo[target.id];
    return arc === undefined ? { kind: 'none' } : { kind: 'arc', arc };
  }
  if (read === null) return { kind: 'no-read' };
  const dossier = readDossier(read.corpus, target.id, read.types, []);
  return dossier === null ? { kind: 'no-record' } : { kind: 'entity', dossier };
}
