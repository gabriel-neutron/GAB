import { z } from 'zod';

import type { Session } from './tool.ts';

/** A document identifier: the database trims it and refuses a blank one, so the tool does too. */
export const documentId = z.string().trim().min(1).max(200);

export const entityHit = z.strictObject({ id: z.uuid(), label: z.string(), type: z.string() });

export const entityHits = z.strictObject({ entities: z.array(entityHit) });

/** Rows of one query, read through the schema of a row, so a shape that drifts raises here. */
export const rowsOf = async <Row extends z.ZodType>(
  session: Session,
  row: Row,
  text: string,
  values: unknown[],
): Promise<z.output<Row>[]> => {
  const { rows } = await session.query(text, values);
  return rows.map((held) => row.parse(held));
};

// External constraint: a door raises its own refusals with this code, and any other code is a
// fault of the database that the caller must see.
const REFUSED_CODE = '22023';

/** A refusal that a door worded for the caller. */
export const isDoorRefusal = (cause: unknown): cause is Error =>
  cause instanceof Error && 'code' in cause && cause.code === REFUSED_CODE;
