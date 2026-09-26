import { z } from 'zod';

import { entityLayout, type LayoutLink } from './layout.ts';

// Departure: the picture follows its input order, and heap order moves after an update, so each
// read is ordered. A relation with an end that is another relation joins no two entities, so the
// walk never sees one and the picture never draws a phantom node.
const ENTITIES = 'SELECT id FROM public.entities ORDER BY id';
const LINKS = `SELECT src_id, dst_id FROM public.relations
                WHERE src_kind = 'entity' AND dst_kind = 'entity'
                ORDER BY src_id, dst_id`;

// Departure: no role writes the table, so the door is the one way a position lands, and the door
// empties the set before it fills it again.
const WRITE = 'SELECT public.set_entity_layout($1::jsonb)';

const entities = z.array(z.object({ id: z.uuid() }));
const links = z.array(z.object({ src_id: z.uuid(), dst_id: z.uuid() }));

interface LayoutDatabase {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
}

/** Computes where the graph draws each entity and stores the run. It answers how many entities
 * the run placed, and it replaces every position the run before it stored. */
export const runLayout = async (on: LayoutDatabase): Promise<number> => {
  const nodes = entities.parse((await on.query(ENTITIES)).rows);
  const edges: LayoutLink[] = links
    .parse((await on.query(LINKS)).rows)
    .map((row) => ({ source: row.src_id, target: row.dst_id }));

  const placed = entityLayout(
    nodes.map((row) => row.id),
    edges,
  );

  await on.query(WRITE, [JSON.stringify(placed)]);
  return placed.length;
};
