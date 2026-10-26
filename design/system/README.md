GAB is a terminal for an investigation: a black control surface where the data is the only thing allowed to carry colour. The chrome copies the Factory style exactly (Obsidian canvas, Geist at weight 400 with negative tracking, Geist Mono uppercase labels, 3px and 10px radii, no shadows). The graph, the map, the detail panels and the animated report extend that style; they never bring a style of their own.

## Principles

1. **The canvas is black, the figure is bright.** Every screen sits on `background`. The only bright object is the selection (`ring`) or one `figure` card. Depth comes from contrast and spacing, never from blur, glow or shadow.
2. **Colour is data, never chrome.** Buttons, tabs, headers and panel edges are neutral. Hue appears only on entity glyphs, relation lines, data states and the one highlighted series of a chart.
3. **Shape before hue.** Every entity type has a glyph shape and every relation family has a dash pattern. A reader who sees no colour still reads the type and the family.
4. **Filled is evidence, hollow is machine.** A promoted fact is a filled glyph. A candidate is the same glyph, hollow, with the word CANDIDATE. This is the one state rule on every surface.
5. **Two voices.** Geist says what a thing is. Geist Mono uppercase says that you look at an instrument: eyebrows, column heads, status tags, units.
6. **Still and precise.** State changes take 150 to 200ms. The report animates step by step, not with scroll effects.

## Content

- Voice: factual, short, attributed. State the finding, then the source and the date. "43% of the fleet changed insurer within six months of designation. Source: GAB graph, counted 2025-10-01."
- Sentence case for every title, button and label in Geist. UPPERCASE only in Geist Mono `caption`.
- No emoji, no exclamation marks, no "Welcome", no friendly empty-state illustration. An empty state says what is missing and the one action that fills it.
- Numbers: tabular figures in `data`; thousands with a comma; dates ISO (`2024-06-24`); coordinates `60.12 N · 27.48 E`.
- A name or a value wraps; it is never cut with an ellipsis.

## Colour

Two themes: **Obsidian** (dark, the Factory original, the default) and **Bone** (light, for print and daylight reading). Bone is not an inversion: every value is measured on its own ground.

| Role | Token | Use |
| --- | --- | --- |
| Ground | `background` | Every page and report section. |
| Raised chrome | `surface` | Rail, detail panel, popover, legend. One level only. |
| Filled action | `surface-secondary` | Secondary button, hovered or selected row. |
| Bright figure | `figure`, `on-figure` | The one key card per screen or chapter. |
| Text | `foreground`, `muted-foreground`, `label` | Names and values; prose and secondary values; mono labels. |
| Lines | `divider`, `border`, `input` | Row hairlines; panel and card outlines; control edges (3:1). |
| Action | `primary`, `primary-foreground` | The one committing button. Neutral. |
| Focus and selection | `ring` | 2px solid, 2px offset; the selection ring on canvases. |
| Live, unverified | `signal`, `candidate` | Candidate data, live pulse, active step, highlighted series. |
| Gain | `positive`, `added` | Added fact, rise in evidence. |
| Stop | `dissent`, `destructive` | Agent disagreement, destructive control (text and edge only). |

- Keep the raw Factory palette (`obsidian-canvas` … `metric-green`) behind the semantic tokens; components read the semantic names.
- Never fill a button, a card or a large area with `signal`, `positive` or an entity hue.
- `signal` and `dissent` are both warm: they differ in lightness (5.7:1 and 8.6:1 on Obsidian) and `dissent` always carries a `!`.

### Data colours

- Entity types: `entity-vessel`, `entity-port`, `entity-facility`, `entity-company`, `entity-bank`, `entity-person`, `entity-state-body`, `entity-legal-act`, `entity-military-unit`, `entity-event`, `entity-unknown`. Each reads at 8:1 or more on Obsidian and 4.5:1 or more on Bone. Shapes in `EntityGlyph`.
- Relation families: `relation-ownership` (neutral, solid), `relation-designation` (signal, long dash), `relation-operation` (green, short dash), `relation-transfer` (blue, dash-dot), `relation-other` (grey, dotted). Patterns in `RelationLine`.
- `entity-event` and `relation-designation` share `signal` on purpose: a claim and a sanction are the two things the reader must notice.
- Charts: `chart-neutral` for context, one highlight in `signal` or `positive`, `chart-grid` and `chart-axis` for the frame.
- Map: `map-water`, `map-land`, `map-boundary`, `map-label`. The basemap stays monochrome so markers carry the colour.
- Sigma and MapLibre read colour strings, not CSS variables: resolve the tokens to hex with `getComputedStyle` on every theme change and repaint without moving the camera.

## Type

- Families: `sans` (Geist) and `mono` (Geist Mono), from Google Fonts. Weight 400 for everything; 500 only in `body-sm-strong`. Never 600 or bold.
- Report scale: `display` 72px (the cover only), `heading-lg` 44px (chapter), `heading` 36px (step title, metric value), `body` 16px (prose, 64ch).
- Interface scale: `heading-sm` 24px (entity name in a panel), `body-sm` 14px (rows, buttons, links).
- Instrument: `caption` 12px mono UPPERCASE; `data` 12px mono for identifiers, coordinates, dates and counts; `data-lg` 14px mono for a key identifier.
- Tracking tightens with size: -2.88px at 72px, -1.1px at 44px, -1.12px at 36px, -0.24px at 12px mono. Line height never above 1.5.
- No serif, no display face, no third family.

## Space, shape, layout

- 8px base: `spacing-8` … `spacing-120`. Working screens add `spacing-4` and `spacing-12` for dense rows.
- Radii: `radius-sm` 3px (buttons, inputs, tags, hover card), `radius-lg` 10px (cards, figure card), `radius-2xl` 20px (the report's framed figure), `radius-0` (canvases, panels on desktop, ghost link). Nothing rounder.
- Shadows: `shadow-none` everywhere; `shadow-hairline` only for a popover over a canvas.
- App layout: `SiteHeader` (56px) on top; `FilterRail` (296px) left; the canvas in the middle at full bleed; `DetailPanel` (400px) right. No sidebar menu, no nested cards.
- Report layout: `page-max-width` 1200px, `ReportSection` grid 5/7, steps 80px apart, chapters 96px apart.

## Motion

- Interface: 150ms, `cubic-bezier(0.4, 0, 0.2, 1)`, on colour, background, border and stroke together. No scale, no spring, no bounce.
- Canvas focus: when the selection changes, non-neighbours fade to 30% in 200ms.
- Report: a step change re-states the figure in 200ms; one entrance per figure (bar growth or line draw) in 600ms. No parallax, no scroll-scrubbed zoom, no word-by-word text.
- `prefers-reduced-motion`: show the final state at once.

## Iconography

- Entity glyphs (`EntityGlyph`) are the main icon set: 14px geometric shapes centred on 0,0, filled or hollow.
- The military unit uses the NATO hostile diamond, with echelon and domain marks from APP-6.
- Interface icons: 14px line icons, 1.25px stroke, `currentColor`. An icon is never the only label of a destructive or unclear action.
- No logo file exists: the wordmark is `GAB` in `caption` style. No emoji, no illustration, no avatar.

## Do not

- No gradient, glass, blur, glow or drop shadow.
- No blue-purple accent, no coloured left-border card, no rounded pill card, no stat cards with invented numbers.
- No hue in the chrome, no second highlight colour in a chart, no colour as the only mark of a state.
- No card inside a card, no panel inside a panel.
- No component with its own palette: the graph, the map and the report charts read the same tokens as the panels.

## Components

Actions: `Button`, `GhostLink`. Status: `StatusTag`. Data marks: `EntityGlyph`, `RelationLine`. Canvas: `GraphCanvas`, `MapCanvas`, `HoverCard`. Panels: `DetailPanel`, `FilterRail`, `SiteHeader`. Report: `ReportSection`, `ReportChart`, `MetricTile`, `FigureCard`. Shared classes live in `components/bundle.css`; read each component's README before building it.
