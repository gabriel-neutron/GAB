// The one vocabulary of the record: the types an entity may take. It is a closed list the
// database declares, and it is why no canvas reads a hue or a name out of a position in a list.
// AN ATTRIBUTE KEY HAS NO VOCABULARY (M11), so nothing is loaded for one.

import { readRows } from './http';
import { toDomain } from './map';
import type { TypeVocabulary } from './model';
import { readOnce } from './once';

// Every row, and never `retired=is.false`: a type leaves service through that flag, and the rows
// promoted under it keep the word. A live vocabulary that dropped it would leave those rows with
// no declared hue and no declared name.
export const loadEntityTypes = readOnce<TypeVocabulary>(async () => {
  const rows = await readRows('entity_type');
  return rows.map((row) => toDomain.entityType(row));
}).load;
