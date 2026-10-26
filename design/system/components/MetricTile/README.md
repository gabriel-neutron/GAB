# MetricTile

One number with its label and a 40px sparkline, set in a row of tiles split by hairlines; the Factory dashboard tile.

- No fill. 1px `divider` between tiles, 20px padding.
- Label: `caption`, `label`. Value: `heading` (36px, weight 400, -1.12px). Unit: `caption` after the value.
- Sparkline: 1px stroke. `signal` for the series the text is about, `positive` for a gain in evidence, `chart-neutral` for context.
- Every number states its date and source in the text next to it or in the chart note. No filler stats.
