export interface UnitOriginProps {
  readonly positionFrom: string | null;
  readonly positionChain: readonly string[];
  readonly affiliation: string | null;
  readonly sourceDay: string | null;
}

/** What the record knows about the position, the affiliation and the date of a unit. A part that
 * the record does not hold is absent, and the whole part is absent when it holds none. */
export function UnitOrigin({
  positionFrom,
  positionChain,
  affiliation,
  sourceDay,
}: UnitOriginProps) {
  // One parent is already named in the sentence above, so the chain shows from two steps.
  if (
    positionFrom === null &&
    positionChain.length < 2 &&
    affiliation === null &&
    sourceDay === null
  )
    return null;
  return (
    <div className="space-y-0.5 text-small/4 text-label">
      {positionFrom === null ? null : <p data-position-from="">{positionFrom}</p>}
      {positionChain.length < 2 ? null : (
        <p data-position-chain="">{`Chain of parents: ${positionChain.join(', then ')}`}</p>
      )}
      {affiliation === null ? null : (
        <p data-affiliation="">
          {`Affiliation: ${affiliation}. This is the point of view of the project, not a legal finding.`}
        </p>
      )}
      {sourceDay === null ? null : (
        <p data-source-day="">
          Newest source read on <span className="font-mono tabular-nums">{sourceDay}</span>
        </p>
      )}
    </div>
  );
}
