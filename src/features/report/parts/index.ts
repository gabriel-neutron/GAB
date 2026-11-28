import { lazy, type ComponentType } from 'react';
import type { ReportPart } from '../content';
import { SummaryPart } from './summary';

/** The drawing of one part. It receives the part from the content, and renders a section whose
 * id is the slug of the part. */
export type PartComponent = ComponentType<{ readonly part: ReportPart }>;

// The code of a part loads only when the part renders: on the release page, when the part comes
// near the view (report page). The summary is in the first view, so its code comes with the page.
const part = (load: () => Promise<PartComponent>): PartComponent =>
  lazy(async () => ({ default: await load() }));

/** One drawing for each slug of the report. A part with a design of its own replaces its
 * default here, in a file of its own. */
export const partComponents: Readonly<Record<string, PartComponent>> = {
  summary: SummaryPart,
  introduction: part(async () => (await import('./introduction')).IntroductionPart),
  'method-chronology': part(async () => (await import('./method-chronology')).MethodChronologyPart),
  pay: part(async () => (await import('./pay/pay-part')).PayPart),
  'ports-fleet': part(async () => (await import('./ports-fleet/ports-fleet-part')).PortsFleetPart),
  finance: part(async () => (await import('./finance/finance-part')).FinancePart),
  fight: part(async () => (await import('./fight/fight-part')).FightPart),
  ownership: part(async () => (await import('./ownership/ownership-part')).OwnershipPart),
  limits: part(async () => (await import('./limits')).LimitsPart),
  conclusion: part(async () => (await import('./conclusion')).ConclusionPart),
  'annex-method': part(async () => (await import('./annex-method')).AnnexMethodPart),
};
