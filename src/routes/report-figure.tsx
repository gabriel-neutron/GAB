import { createFileRoute } from '@tanstack/react-router';
import { PriceFigure } from '@/features/report/figures';
import { BudgetFigure } from '@/features/report/budget-figure';
import { BuyersFigure } from '@/features/report/buyers-figure';
import { PortsFigure } from '@/features/report/ports-figure';
import {
  CrudeAndProducts,
  EuImportsBeforeAfter,
  PortsBeforeAfter,
} from '@/features/report/ports-versions';
import { CrudeBuyersFigure } from '@/features/report/crude-buyers-figure';
import { FlowsFigure } from '@/features/report/flows-figure';
import { VesselsFigure } from '@/features/report/vessels-figure';
import { FleetPortsFigure, FleetWavesFigure } from '@/features/report/fleet-figures';
import { CurrenciesFigure } from '@/features/report/currencies-figure';
import { ChpFigure } from '@/features/report/chp-figure';
import { CasesFigure } from '@/features/report/cases-figure';
import { ControllersFigure } from '@/features/report/controllers-figure';
import { AtlasFigure } from '@/features/report/atlas-figure';
import { MethodDiagram } from '@/features/report/method-diagram';
import '@/features/report/report.css';

// The still figures of the paper report; tools/report/export-figures.ts saves each one as SVG.
const figures = {
  prices: () => <PriceFigure print />,
  method: MethodDiagram,
  buyers: BuyersFigure,
  budget: BudgetFigure,
  ports: PortsFigure,
  'crude-buyers': CrudeBuyersFigure,
  flows: FlowsFigure,
  vessels: VesselsFigure,
  'fleet-ports': FleetPortsFigure,
  'fleet-waves': FleetWavesFigure,
  currencies: CurrenciesFigure,
  chp: ChpFigure,
  cases: CasesFigure,
  controllers: ControllersFigure,
  atlas: AtlasFigure,
  'ports-v1': PortsBeforeAfter,
  'ports-v2': CrudeAndProducts,
  'ports-v3': EuImportsBeforeAfter,
};
export const Route = createFileRoute('/report-figure')({
  validateSearch: (s: Record<string, unknown>) => ({
    name: typeof s['name'] === 'string' ? s['name'] : 'prices',
  }),
  component: function ReportFigure() {
    const { name } = Route.useSearch();
    const Figure = name in figures ? figures[name as keyof typeof figures] : undefined;
    return (
      <div className="report-page" style={{ width: 640, padding: 0 }}>
        {Figure ? <Figure /> : <p>Unknown figure {name}</p>}
      </div>
    );
  },
});
