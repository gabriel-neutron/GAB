import { z } from 'zod';

import { headerSignature } from './header-signature.ts';
import { documentId } from './fields.ts';
import { readTablePage, tableOf } from './table.ts';
import { defineTool } from './tool.ts';

// Origin: decided, not calibrated. Twenty rows show a model the shape of a list and no more of it.
const SAMPLE_ROWS = 20;

// A long cell is a free text, and its first words show its kind as well as the whole of it.
const CELL_LENGTH = 200;

const cut = (text: string): string =>
  Array.from(text).length > CELL_LENGTH ? Array.from(text).slice(0, CELL_LENGTH).join('') : text;

export const fileSchemaSample = defineTool({
  name: 'file_schema_sample',
  description:
    'Reads the header of one stored table, the number of its rows, and its first ' +
    `${String(SAMPLE_ROWS)} rows. It returns no other row of the file. Use it before you map the ` +
    'columns of a table.',
  input: z.strictObject({ document: documentId }),
  output: z.strictObject({
    document: z.string(),
    header: z.array(z.string()),
    headerSig: z.string(),
    rowCount: z.number().int(),
    rows: z.array(z.strictObject({ row: z.number().int(), values: z.array(z.string()) })),
  }),
  async run(session, input) {
    const { text } = await readTablePage(session, input.document);
    const { header, rows } = tableOf(text);
    return {
      document: input.document,
      header,
      headerSig: headerSignature(header),
      rowCount: rows.length,
      rows: rows
        .slice(0, SAMPLE_ROWS)
        .map((held, index) => ({ row: index + 1, values: held.fields.map(cut) })),
    };
  },
});
