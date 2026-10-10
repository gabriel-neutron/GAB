import { mappingDraft, missingColumns } from '@gab/proposal/mapping';
import { z } from 'zod';

import { headerSignature } from './header-signature.ts';
import { documentId, rowsOf } from './fields.ts';
import { readTablePage, tableOf } from './table.ts';
import { defineTool, ToolRefusal } from './tool.ts';

const PROPOSE = 'SELECT public.propose_mapping($1::text, $2::jsonb, $3::uuid)::text AS id';

const identified = z.strictObject({ id: z.uuid() });

/** The propose tool of the mapper. The runner knows the model call of the mapping, so it is no
 * input that a caller gives. The database holds the rules of the act. */
export const proposeMappingOf = (modelCallId: string) =>
  defineTool({
    name: 'propose_mapping',
    description:
      'Proposes how the columns of one stored table map to the record: the type and the name of ' +
      'the entity of each row, the lookup that finds it, each attribute with its cast, and the ' +
      'relations. The operator decides the mapping, and code then loads every row.',
    input: z.strictObject({ document: documentId, mapping: mappingDraft }),
    output: z.strictObject({ proposalId: z.uuid() }),
    async run(session, input) {
      const { header } = tableOf((await readTablePage(session, input.document)).text);
      const faults = missingColumns(input.mapping, header);
      if (faults.length > 0) throw new ToolRefusal(faults.join('; '));

      const [made] = await rowsOf(session, identified, PROPOSE, [
        input.document,
        JSON.stringify({ ...input.mapping, header_sig: headerSignature(header) }),
        modelCallId,
      ]);
      if (made === undefined)
        throw new Error('the door stored a mapping and returned no identifier');
      return { proposalId: made.id };
    },
  });
