# Report

The application report lives at `/`; its references live at `/bibliography`.
Both routes use the application header, theme, Geist fonts and semantic tokens.
The static release writer prerenders both routes.

`report-page.tsx` owns the scroll container and entity dialog. `report-content.tsx`
composes the journal. `figures.tsx` provides the price chart, port map, evidence
graph and entity records; `citations.tsx` provides source popovers and APA entries.
`report-background.tsx` draws the Asciify field in response to scrolling and pointer
movement. Motion follows the reduced-motion preference. Styles are scoped to
`.report-page` so the other application views retain their layout.

Replace editorial copy and image metadata in `content.ts`, observations in
`prices-data.ts`, and documented entities/relations in `nodes-data.ts` and
`edges-data.ts`. Keep the downloadable counterparts in `public/report-data` in
sync. Image assets and attribution are in `public/report-media`. Basemap geometry
comes from Natural Earth. Missing price observations remain missing.

The report is an editorial excerpt of the October 2026 working report; its English
translation still needs editorial review. Local records retain the source evidence
and offer links to the application's entity and graph routes when a corpus UUID
exists. The report's local graph is a documented subset, not a live corpus query.
