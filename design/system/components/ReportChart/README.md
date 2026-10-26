# ReportChart

A report figure where everything is `chart-neutral` except the one series the sentence is about, which takes `signal`.

## Rules
- Caption above: `caption` figure number and title, then one `body` sentence in `muted-foreground` that states the finding.
- Gridlines `chart-grid` 1px, horizontal only. Axis labels `data` style in `chart-axis`. No chart border, no background box.
- One highlight colour per chart: `signal` (or `positive` for a gain in evidence). Categories by entity type take the `entity-*` tokens and the legend repeats their glyphs.
- Annotations: a 1px `foreground` leader and a `caption` label. Never a coloured callout box.
- Source line below in `data` `muted-foreground`, with the date the data was counted.
- Bar and line marks are flat: no rounded bar tops, no gradient, no shadow.

## Motion in the report
- A chart enters once when its step becomes active: bars grow from the baseline or the line draws, 600ms, `cubic-bezier(0.4, 0, 0.2, 1)`, 40ms stagger at most.
- Under `prefers-reduced-motion` the final state shows at once.
