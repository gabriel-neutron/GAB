import type { ReleaseFile } from './csv-export.ts';
import type { RowLicence } from './licence.ts';
import type { ReleaseHeading } from './release-heading.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';

// The identifiers of a release and the terms of its vocabulary are under the address of the
// public repository, which the project controls. A release never changes them, because a reuser
// links to them.
const BASE = 'https://github.com/gabriel-neutron/GAB/id/';
const VOCABULARY = 'https://github.com/gabriel-neutron/GAB/vocabulary#';

const CONTEXT = {
  '@version': 1.1,
  '@base': BASE,
  gab: VOCABULARY,
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
  licence: 'gab:licence',
  license: { '@id': 'dct:license', '@type': '@id' },
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
  address: 'schema:url',
  readOn: 'gab:readOn',
} as const;

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
    'licence',
    'Property',
    'licence',
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
  term('readOn', 'Property', 'read on', 'When the project read the document.'),
];

// The address of a licence that has one. The fixed text of a derived fact names no licence.
const LICENCE_ADDRESS: Record<RowLicence, string | null> = {
  'CC-BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'derived fact; source under the provider licence, not redistributed': null,
};

const path = (kind: string, id: string): string =>
  `${kind}/${id.split('/').map(encodeURIComponent).join('/')}`;

// A field with no value is not written.
const present = (fields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields).filter(([, one]) => one !== null && one !== undefined));

/** The JSON-LD file of a release: one graph with the dataset, each entity, relation, claim and
 * public document, and the definition of each term of the vocabulary of a release. Each row
 * keeps its origin label, its licence and its sources, and each claim its passages. */
export const jsonldExport = (record: ReleaseRecord, heading: ReleaseHeading): ReleaseFile => {
  const { documentOf, licenceOf, labelOf, relationOf } = releaseLookup(record);
  const entityId = (id: string): string => {
    labelOf(id);
    return path('entity', id);
  };
  const relationId = (id: string): string => path('relation', relationOf(id).id);
  const documentId = (id: string): string => path('document', documentOf(id).id);
  const trust = (row: { origin_label: string; sources: readonly string[] }) => {
    const licence = licenceOf(row.sources);
    return present({
      originLabel: row.origin_label,
      licence,
      license: LICENCE_ADDRESS[licence],
      sources: row.sources.map(documentId),
    });
  };

  const dataset = {
    '@id': `release/${heading.date}`,
    '@type': 'Dataset',
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
    passages: one.passages.map((passage) => ({
      '@type': 'Passage',
      document: documentId(passage.document),
      page: passage.page,
      excerpt: passage.excerpt,
      modality: passage.modality,
      transcribed: passage.transcribed,
    })),
  });
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
    ...VOCABULARY_TERMS,
  ];
  return {
    path: 'dataset.jsonld',
    text: `${JSON.stringify({ '@context': CONTEXT, '@graph': graph })}\n`,
  };
};
