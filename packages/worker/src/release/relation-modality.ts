import { DataFault } from './tanker-port-calls.ts';

/** One `owns` relation (owner to vessel) with the modalities of the citations of its act and the
 * originator of that act. */
export interface OwnsRow {
  readonly imo: string;
  readonly vessel: string;
  readonly owner: string;
  readonly relation: string;
  readonly originator: string | null;
  readonly modalities: readonly string[];
  readonly sources: readonly string[];
}

// The act of a relation is the proposal that it was promoted from. The modality is on the citations
// of the act, and the originator is on the act.
export const OWNS_QUERY = `
  SELECT v.attrs->'imo'->>'v' AS imo, v.label AS vessel, o.label AS owner, r.id::text AS relation,
         p.originator,
         coalesce(array_agg(DISTINCT c.modality ORDER BY c.modality)
                  FILTER (WHERE c.modality IS NOT NULL), '{}') AS modalities,
         r.sources::text[] AS sources
    FROM public.relations r
    JOIN public.entities v ON v.id = r.dst_id
    JOIN public.entities o ON o.id = r.src_id
    JOIN public.proposals p ON p.id = r.promoted_from
    LEFT JOIN public.citation c ON c.claim_id = p.id
   WHERE r.type = 'owns' AND r.src_kind = 'entity' AND r.dst_kind = 'entity'
     AND v.attrs->'imo'->>'v' = ANY($1::text[])
   GROUP BY v.attrs->'imo'->>'v', v.label, o.label, r.id, p.originator, r.sources
   ORDER BY 1, 3, 4`;

/** The file of the IMO numbers: a header `imo`, lines that start with # as comments, and one IMO
 * number on each line. */
export const imoList = (text: string): string[] => {
  const [header, ...lines] = (text.codePointAt(0) === 0xfeff ? text.slice(1) : text)
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== '' && !line.startsWith('#'));
  if (header?.trim() !== 'imo')
    throw new DataFault('The IMO file must start with the header "imo".');
  return lines.map((line) => {
    const imo = line.trim();
    if (!/^\d{7}$/u.test(imo)) throw new DataFault(`The line "${line}" is not an IMO number.`);
    return imo;
  });
};

const dash = (text: string | null | undefined): string =>
  text === null || text === undefined || text === '' ? '-' : text;

/** The lines of the report, with tab-separated columns: IMO, vessel, owner, relation, modalities,
 * originator, source documents. An IMO number with no `owns` relation gets a line that says so. */
export const modalityLines = (imos: readonly string[], rows: readonly OwnsRow[]): string[] =>
  imos.flatMap((imo) => {
    const own = rows.filter((one) => one.imo === imo);
    if (own.length === 0) return [`${imo}\t-\t-\t-\tno owns relation\t-\t-`];
    return own.map((one) =>
      [
        imo,
        one.vessel,
        one.owner,
        one.relation,
        one.modalities.length === 0 ? 'no citation' : one.modalities.join(','),
        dash(one.originator),
        dash(one.sources.join(',')),
      ].join('\t'),
    );
  });
