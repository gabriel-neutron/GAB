# ReportSection

One step of the animated report: a text column on the left and a sticky figure on the right that changes when the step becomes active.

## Layout
- Grid 5/7 inside `page-max-width`, 56px gap. Steps are 80px apart (`spacing-80`), chapters 96px (`spacing-96`).
- Text column: `caption` eyebrow with chapter and step (`Step 03 / 06`), title in `heading-lg`, prose in `body` `muted-foreground` at 64ch, key words in `foreground` (weight 400, never bold), a step meter (2px bars, active ones `signal`), a `GhostLink` to the live graph or map.
- Figure: a frame with `radius-2xl` and a 1px `divider`, or a `FigureCard` for one key number. Inside it the figure reuses `GraphCanvas`, `MapCanvas` or `ReportChart` marks; never a separate chart style.
- The report cover alone uses `display` (72px).

## Motion
- Scroll moves between steps; it does not drive continuous effects. No parallax, no scroll-scrubbed zoom, no spring.
- On step enter: the figure changes state in 200ms (`cubic-bezier(0.4, 0, 0.2, 1)`), new marks fade in, highlighted marks switch to full opacity, the rest drops to 30%, exactly as the focus rule of the graph.
- One entrance per figure at most (bar growth or line draw, 600ms). Text does not animate word by word.
- `prefers-reduced-motion`: every step shows its final state, no transition.

## Consumer provides
The step list (`id`, eyebrow, title, prose, figure state), the figure component, the link target.
