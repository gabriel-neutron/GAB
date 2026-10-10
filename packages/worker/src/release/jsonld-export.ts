import type { ReleaseFile } from './csv-export.ts';
import type { RowLicence } from './licence.ts';
import type { ReleaseHeading } from './release-heading.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';

// The identifiers and the terms of the vocabulary are under the base that the manifest gives.
const contextOf = (base: string) => ({
  '@version': 1.1,
  '@base': base,
  gab: `${base}vocabulary#`,
  schema: 'https://schema.org/',
  dct: 'http://purl.org/dc/terms/',
  prov: 'http://www.w3.org/ns/prov#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  Class: 'rdfs:Class',
  Property: 'rdf:Property',
  label: 'rdfs:label',
  comment: 'rdfs:comment',
  Dataset: 'schema:Dataset',
  name: 'schema:name',
  version: 'schema:version',
  datePublished: { '@id': 'schema:datePublished', '@type': 'xsd:date' },
  disclaimer: 'gab:disclaimer',
  Entity: 'gab:Entity',
  entityType: 'gab:entityType',
  Relation: 'gab:Relation',
  relationType: 'gab:relationType',
  from: { '@id': 'gab:from', '@type': '@id' },
  to: { '@id': 'gab:to', '@type': '@id' },
  validFrom: { '@id': 'schema:validFrom', '@type': 'xsd:date' },
  validThrough: { '@id': 'schema:validThrough', '@type': 'xsd:date' },
  Claim: 'gab:Claim',
  claimId: 'dct:identifier',
  claimKind: 'gab:claimKind',
  about: { '@id': 'schema:about', '@type': '@id' },
  attribute: 'gab:attribute',
  value: { '@id': 'gab:value', '@type': '@json' },
  originLabel: 'gab:originLabel',
  licenceText: 'gab:licenceText',
  license: { '@id': 'dct:license', '@type': '@id' },
  isReplacedBy: { '@id': 'dct:isReplacedBy', '@type': '@id' },
  sources: { '@id': 'prov:wasDerivedFrom', '@type': '@id', '@container': '@set' },
  passages: { '@id': 'gab:passage', '@container': '@set' },
  Passage: 'gab:Passage',
  document: { '@id': 'dct:source', '@type': '@id' },
  page: 'gab:page',
  excerpt: 'gab:excerpt',
  modality: 'gab:modality',
  transcribed: 'gab:transcribed',
  Document: 'gab:Document',
  title: 'dct:title',
  address: { '@id': 'schema:url', '@type': 'xsd:anyURI' },
  readOn: { '@id': 'gab:readOn', '@type': 'xsd:date' },
});

const NATO_CONTEXT = {
  natoLetter: 'gab:natoLetter',
  natoDigit: { '@id': 'gab:natoDigit', '@type': 'xsd:integer' },
};

const term = (
  id: string,
  type: 'Class' | 'Property',
  label: string,
  comment: string,
): Record<string, string> => ({ '@id': `gab:${id}`, '@type': type, label, comment });

// The definition of each term of the vocabulary of a release. The other terms come from
// schema.org, Dublin Core, PROV-O and RDF Schema, which define them.
const VOCABULARY_TERMS = [
  term(
    'Entity',
    'Class',
    'entity',
    'A thing of the record: a vessel, a company, a person, a place or an act.',
  ),
  term('Relation', 'Class', 'relation', 'A link of one type from one entity to one entity.'),
  term(
    'Claim',
    'Class',
    'claim',
    'One fact of the record: a value of an entity or of a relation, or a relation. Each claim has its sources, its origin label and its licence.',
  ),
  term(
    'Passage',
    'Class',
    'passage',
    'The part of a source document that holds the words of a claim.',
  ),
  term('Document', 'Class', 'document', 'A public source document of the record.'),
  term(
    'disclaimer',
    'Property',
    'disclaimer',
    'The disclaimer of the dataset. Each copy of the data must keep it.',
  ),
  term(
    'entityType',
    'Property',
    'entity type',
    'The type of the entity, for example vessel or company.',
  ),
  term(
    'relationType',
    'Property',
    'relation type',
    'The type of the relation, for example owns or designated_by.',
  ),
  term('from', 'Property', 'from', 'The entity at the start of the relation.'),
  term('to', 'Property', 'to', 'The entity at the end of the relation.'),
  term(
    'claimKind',
    'Property',
    'claim kind',
    'attribute: the claim gives a value of an entity or of a relation. relation: the claim is the relation itself.',
  ),
  term('attribute', 'Property', 'attribute', 'The key of the value that the claim gives.'),
  term('value', 'Property', 'value', 'The value that the claim gives, as JSON.'),
  term(
    'originLabel',
    'Property',
    'origin label',
    'Who or what decided the row, and on which day, in fixed words. A row that no person read says so.',
  ),
  term(
    'licenceText',
    'Property',
    'licence text',
    'The licence of the row, from the providers of its public documents: CC-BY 4.0, CC-BY-NC 4.0, or "derived fact; source under the provider licence, not redistributed".',
  ),
  term('passage', 'Property', 'passage', 'A passage of a source document that holds the claim.'),
  term(
    'page',
    'Property',
    'page',
    'The page of the document that holds the passage. The first page is 1.',
  ),
  term('excerpt', 'Property', 'excerpt', 'The words of the passage, as the document gives them.'),
  term(
    'modality',
    'Property',
    'modality',
    'How the passage holds the claim, for example asserts or enacts.',
  ),
  term(
    'transcribed',
    'Property',
    'transcribed',
    'true when an AI read the passage from an image of the page.',
  ),
  term('readOn', 'Property', 'read on', 'The day when the project read the document.'),
];

const NATO_TERMS = [
  term(
    'natoLetter',
    'Property',
    'NATO letter',
    'The reliability of the author, from A (reliable) to F (cannot be judged), as in the NATO rating (STANAG 2511). It is the best letter among the authors whose sources support the fact. It rates the author, never the fact.',
  ),
  term(
    'natoDigit',
    'Property',
    'NATO digit',
    'The credibility of the fact, from 1 (confirmed by independent sources) to 6 (cannot be judged), as in the NATO rating (STANAG 2511). It comes from the number of independent authors that give the fact and from the conflicts between the values of its sources. It never reads a letter.',
  ),
];

// The address of a licence that has one. The fixed text of a derived fact names no licence.
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const LICENCE_ADDRESS: Record<RowLicence, string | null> = {
  'CC-BY 4.0': CC_BY,
  'CC-BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'derived fact; source under the provider licence, not redistributed': null,
};

const path = (kind: string, id: string): string =>
  `${kind}/${id.split('/').map(encodeURIComponent).join('/')}`;

// A field with no value is not written.
const present = (fields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields).filter(([, one]) => one !== null && one !== undefined));

/** The JSON-LD file of a release: one graph with the dataset, each entity, relation, claim and
 * cited document, each absorbed entity with the entity that replaces it, and the definition of
 * each term of the vocabulary of a release. Each row keeps its origin label, its licence and its
 * sources, and each claim its passages. When the release shows the NATO pair, each claim that has
 * one also gives its letter and its digit. The identifiers are paths under `base`. */
export const jsonldExport = (
  record: ReleaseRecord,
  heading: ReleaseHeading,
  base: string,
): ReleaseFile => {
  const { documentOf, entityOf, licenceOf, relationOf } = releaseLookup(record);
  const { natoPairs } = record;
  const nato = (one: ReleaseClaim) => {
    const pair = natoPairs?.get(one.claim_id);
    return pair === undefined ? {} : { natoLetter: pair.letter, natoDigit: pair.digit };
  };
  const entityId = (id: string): string => path('entity', entityOf(id).id);
  const relationId = (id: string): string => path('relation', relationOf(id).id);
  const documentId = (id: string): string => path('document', documentOf(id).id);
  const trust = (row: { origin_label: string; sources: readonly string[] }) => {
    const licence = licenceOf(row.sources);
    return present({
      originLabel: row.origin_label,
      licenceText: licence,
      license: LICENCE_ADDRESS[licence],
      sources: row.sources.map(documentId),
    });
  };

  const dataset = {
    '@id': path('release', heading.version),
    '@type': 'Dataset',
    license: CC_BY,
    name: heading.title,
    version: heading.version,
    datePublished: heading.date,
    disclaimer: heading.disclaimer,
  };
  const entities = record.entities.map((one) => ({
    '@id': entityId(one.id),
    '@type': 'Entity',
    entityType: one.type,
    name: one.label,
    ...trust(one),
  }));
  const relations = record.relations.map((one) => ({
    '@id': path('relation', one.id),
    '@type': 'Relation',
    relationType: one.type,
    from: entityId(one.src_id),
    to: entityId(one.dst_id),
    ...present({ validFrom: one.valid_from, validThrough: one.valid_to }),
    ...trust(one),
  }));
  const claim = (one: ReleaseClaim) => ({
    '@id': path('claim', one.claim_id),
    '@type': 'Claim',
    claimId: one.claim_id,
    ...(one.attribute === null
      ? { claimKind: 'relation', about: relationId(one.subject_id) }
      : {
          claimKind: 'attribute',
          about:
            one.subject_kind === 'relation' ? relationId(one.subject_id) : entityId(one.subject_id),
          ...present({ attribute: one.attribute, value: one.value }),
        }),
    ...trust(one),
    ...nato(one),
    passages: one.passages.map((passage) => ({
      '@type': 'Passage',
      document: documentId(passage.document),
      page: passage.page,
      excerpt: passage.excerpt,
      modality: passage.modality,
      transcribed: passage.transcribed,
    })),
  });
  // An absorbed identifier resolves to one entity while its merge stands. An undone merge has no
  // node, because the entity is back.
  const replaced = new Map(
    record.merges.flatMap((one) =>
      one.resolves_to === null ? [] : [[one.absorbed_id, entityId(one.resolves_to)] as const],
    ),
  );
  const replacements = [...replaced].map(([absorbed, survivor]) => ({
    '@id': path('entity', absorbed),
    isReplacedBy: survivor,
  }));
  const documents = [...record.documents.values()].map((one) => ({
    '@id': path('document', one.id),
    '@type': 'Document',
    title: one.title,
    ...present({ address: one.uri, readOn: one.retrieved_at }),
  }));

  const graph = [
    dataset,
    ...entities,
    ...relations,
    ...record.claims.map(claim),
    ...documents,
    ...replacements,
    ...VOCABULARY_TERMS,
    ...(natoPairs === null ? [] : NATO_TERMS),
  ];
  const context = { ...contextOf(base), ...(natoPairs === null ? {} : NATO_CONTEXT) };
  return {
    path: 'dataset.jsonld',
    text: `${JSON.stringify({ '@context': context, '@graph': graph })}\n`,
  };
};
