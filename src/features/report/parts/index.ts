import type { ReactNode } from 'react';
import type { ReportPart } from '../content';
import { PartDefault } from './part-default';
import { IntroductionPart } from './introduction';
import { MethodChronologyPart } from './method-chronology';
import { PayPart } from './pay/pay-part';
import { PortsFleetPart } from './ports-fleet/ports-fleet-part';
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
  finance: PartDefault,
  fight: PartDefault,
  ownership: PartDefault,
  limits: PartDefault,
  conclusion: PartDefault,
  'annex-method': PartDefault,
};
