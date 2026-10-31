import type { ReactNode } from 'react';
import type { ReportPart } from '../content';
import { FinancePart } from './finance/finance-part';
import { FightPart } from './fight/fight-part';
import { AnnexMethodPart } from './annex-method';
import { ConclusionPart } from './conclusion';
import { IntroductionPart } from './introduction';
import { MethodChronologyPart } from './method-chronology';
import { OwnershipPart } from './ownership/ownership-part';
import { PayPart } from './pay/pay-part';
import { PortsFleetPart } from './ports-fleet/ports-fleet-part';
import { LimitsPart } from './limits';
import { SummaryPart } from './summary';

/** The drawing of one part. It receives the part from the content, and renders a section whose
 * id is the slug of the part. */
export type PartComponent = (props: { readonly part: ReportPart }) => ReactNode;

/** One drawing for each slug of the report. A part with a design of its own replaces its
 * default here, in a file of its own. */
export const partComponents: Readonly<Record<string, PartComponent>> = {
  summary: SummaryPart,
  introduction: IntroductionPart,
  'method-chronology': MethodChronologyPart,
  pay: PayPart,
  'ports-fleet': PortsFleetPart,
  finance: FinancePart,
  fight: FightPart,
  ownership: OwnershipPart,
  limits: LimitsPart,
  conclusion: ConclusionPart,
  'annex-method': AnnexMethodPart,
};
