import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { READING_LINK } from '@/shared/page/reading-link';

import type { EntityRow, GlobeData } from './globe-data';

export interface EntityListProps {
  readonly data: GlobeData;
  /** The address of the page of one entity. */
  readonly entityHref: (id: string) => string;
}

/** The entities that have a position, each with a link to its page. It stands under the globe,
 * and it stays readable in a browser that cannot draw the globe. */
export function EntityList({ data, entityHref }: EntityListProps) {
  const columns: readonly DataColumn<EntityRow>[] = [
    {
      key: 'entity',
      header: 'Entity',
      cell: (row) => (
        <a className={READING_LINK} href={entityHref(row.id)}>
          {row.label}
        </a>
      ),
    },
    { key: 'type', header: 'Type', cell: (row) => row.type },
    { key: 'stage', header: 'Stage', cell: (row) => row.stage },
    { key: 'geometry', header: 'Geometry', cell: (row) => row.geometry },
  ];
  return (
    <DataTable
      name="Entities with a position"
      columns={columns}
      rows={data.rows.map((row) => ({ id: row.id, row }))}
      empty="No entity of this release has a position."
    />
  );
}
