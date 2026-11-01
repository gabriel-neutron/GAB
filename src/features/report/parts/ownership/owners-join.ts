import controllersRaw from '../../data/controllers.csv?raw';
import ownersRaw from '../../data/owners.csv?raw';
import { readCsv } from '../../line-panel';
import nodes from '../../nodes-data';

/** One site of the owners map: the node, the node that holds it, and the controller class and
 * holding of the owners figure (controllers.csv) that the holder falls in. */
export interface Owner {
  readonly nodeId: string;
  readonly holderId: string;
  /** A code: owns, owns_majority, owns_operator or operates. The copy gives its words. */
  readonly relation: string;
  readonly sharePct: string;
  readonly controller: string;
  readonly holding: string;
  /** The documents of the record that support the chain from the site to the holder. */
  readonly documents: readonly string[];
  /** The day of the check against the record. */
  readonly checked: string;
}

const RELATIONS = new Set(['owns', 'owns_majority', 'owns_operator', 'operates']);
const DOC = /^doc_[0-9a-f]{12}$/;

export const parseOwners = (raw: string): Owner[] =>
  readCsv(raw).map((row) => ({
    nodeId: row['node_id'] ?? '',
    holderId: row['holder_id'] ?? '',
    relation: row['relation'] ?? '',
    sharePct: row['share_pct'] ?? '',
    controller: row['controller'] ?? '',
    holding: row['holding'] ?? '',
    documents: (row['documents'] ?? '').split(' ').filter((doc) => doc !== ''),
    checked: row['checked'] ?? '',
  }));

/** The faults of the join: a site or a holder with no node id or an unknown one, a site with no
 * position, a controller and holding that the owners figure does not have, or no document. */
export function ownerFaults(
  owners: readonly Owner[],
  controllers: readonly Readonly<Record<string, string>>[],
  known: ReadonlyMap<string, { readonly lat: string; readonly lon: string }>,
): string[] {
  const pairs = new Set(controllers.map((row) => `${row['controller']}|${row['holding']}`));
  const seen = new Set<string>();
  return owners.flatMap((owner, index) => {
    const at = `row ${String(index + 1)}`;
    const site = known.get(owner.nodeId);
    const faults = [
      site === undefined && `${at}: unknown node id "${owner.nodeId}"`,
      site !== undefined && (site.lat === '' || site.lon === '') && `${at}: no position`,
      seen.has(owner.nodeId) && `${at}: second row for ${owner.nodeId}`,
      !known.has(owner.holderId) && `${at}: unknown holder id "${owner.holderId}"`,
      !RELATIONS.has(owner.relation) && `${at}: unknown relation "${owner.relation}"`,
      !pairs.has(`${owner.controller}|${owner.holding}`) &&
        `${at}: "${owner.controller}" / "${owner.holding}" is not in the owners figure`,
      owner.documents.length === 0 && `${at}: no document`,
      owner.documents.some((doc) => !DOC.test(doc)) && `${at}: bad document id`,
      !/^\d{4}-\d{2}-\d{2}$/.test(owner.checked) && `${at}: no check date`,
    ];
    seen.add(owner.nodeId);
    return faults.filter((fault): fault is string => fault !== false);
  });
}

export const controllerRows = readCsv(controllersRaw);
export const nodeSites = new Map(nodes.map((node) => [node.node_id, node]));
/** The sites of the owners map, from the committed join. */
export const owners = parseOwners(ownersRaw);
