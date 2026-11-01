import { parts } from './content';
import edges from './edges-data';
import nodes from './nodes-data';

export type GraphNode = (typeof nodes)[number];
export type GraphEdge = (typeof edges)[number];

const byId = new Map(nodes.map((node) => [node.node_id, node]));

// A document identifier can sit in any field: a condition, a size, the source of a place.
const DOCUMENT = /doc_[0-9a-f]+/g;
const documentsIn = (row: Readonly<Record<string, string>>): readonly string[] => [
  ...new Set(Object.values(row).flatMap((value) => value.match(DOCUMENT) ?? [])),
];

// The report types are not the vocabulary of the corpus. Each one takes the glyph of the nearest
// entity type. Any other type passes as it is: a corpus type keeps its glyph, and a type with no
// shape draws the dashed circle of `unknown`.
const GLYPHS: Readonly<Record<string, string>> = {
  terminal: 'port',
  pipeline: 'facility',
  plant: 'facility',
  fleet: 'vessel',
  producer: 'company',
  operator: 'company',
  intermediary: 'company',
};

const allDocuments = new Set([...nodes, ...edges].flatMap((row) => documentsIn(row)));

/** The nodes and their relations, read once from the data files of the report. Each lookup here
 * is one job: tell what the data says about a node. */
export const reportGraph = {
  node: (id: string): GraphNode | undefined => byId.get(id),
  relations: (id: string): readonly GraphEdge[] =>
    edges.filter((edge) => edge.source === id || edge.target === id),
  documents: documentsIn,
  glyph: (type: string): string => GLYPHS[type] ?? type,
  layer: (layer: string): readonly GraphNode[] =>
    nodes
      .filter((node) => node.layer === layer)
      .sort((a, b) => Number(a.rank_in_layer) - Number(b.rank_in_layer)),
  counts: {
    nodes: nodes.length,
    relations: edges.length,
    documents: allDocuments.size,
    sources: parts.reduce((sum, part) => sum + part.notes.length, 0),
  },
};
