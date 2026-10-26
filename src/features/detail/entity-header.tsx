import type { ReactNode } from 'react';

import type { Dossier } from './dossier';
import { EntityGlyph } from './glyph';
import { CAPTION, DATA } from './style';
import { Tag } from './tag';

export interface EntityHeaderProps {
  readonly dossier: Dossier;
  /** The links and controls under the tags. */
  readonly actions?: ReactNode;
  /** The lines under the name: identifiers of a vessel, the origin of a unit. */
  readonly children?: ReactNode;
}

/** The head of the panel: the eyebrow (glyph, type, main identifier), the name, the tags. */
export function EntityHeader({ dossier, actions, children }: EntityHeaderProps) {
  const identifier = dossier.facts?.imo ?? null;
  const candidate = dossier.pending.length > 0;
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${CAPTION}`}>
          <EntityGlyph type={dossier.type} />
          <span>{dossier.typeName}</span>
          {/* The extracted word is kept where it was not a live type, and it is drawn, or the
              entry the analyst wrote is lost to every reader of the record. */}
          {dossier.proposedType === null ? null : (
            <span>{`proposed as ${dossier.proposedType}`}</span>
          )}
          {identifier === null ? null : (
            <span className={`${DATA} text-foreground normal-case`}>{`IMO ${identifier}`}</span>
          )}
        </p>
        <h1 className="min-w-0 text-heading-sm break-words">{dossier.label}</h1>
      </div>
      {dossier.sanctioned || candidate ? (
        <p className="flex flex-wrap items-center gap-2">
          {dossier.sanctioned ? <Tag kind="figure">Sanctioned</Tag> : null}
          {candidate ? (
            <Tag kind="candidate">{`Candidate ${String(dossier.pending.length)}`}</Tag>
          ) : null}
        </p>
      ) : null}
      {children}
      {actions}
    </header>
  );
}
