# ADR 0020 — A release publishes files and a static site, with no public API

**Status** Superseded by ADR 0028 · 18 October 2026 · Accepted 10 October 2026

**Superseded by ADR 0028.** On 18 October 2026 the operator asked for one site: the application,
with all the pages, which hides each part that needs a backend when the backend does not answer.
ADR 0028 lists the rules below that stay true. The rule that the site holds no script except
the map script ends.

**Replaces** the hosted read API of the deployment guide as the public surface of Gabriel.

## Context

The FNF investigation promises a public site: the critical nodes table, a page for each entity, an
address for each claim, a map, the downloads and the method. The deployment guide published the
read API and the application of the operator to a host. A hosted API costs money and time, and it
is a server that an attacker can reach. A reader cites the pages of the site, so their addresses
and their form are costly to change after the first publication.

## Decision

### The release writes the site

- The release command writes the static site of each release beside its folder of files, in a
  folder named by the same date. The site is a pure function of the files of the release folder:
  it reads no database and no API. So a copy of the release folder gives the same site, and a
  test builds the site from a fixed release with no stack.
- The pages are React components (ADR 0004) that the release renders to HTML. Vite loads them,
  because Node does not run JSX, and Tailwind builds the stylesheet from the one stylesheet of the
  application, so the site has no second palette. The same components have stories.
- The site holds a copy of each file of the release, byte for byte, so the downloads page links
  files of the site and the checksums of the manifest stay true.
- The site holds no script, except the map script. No page sends a request to a server other than
  the host of the site. The links to a source document and the two contact links are links that
  the reader opens.

### The pages and their addresses

- The home page is the critical nodes table, the retained nodes first.
- An entity, a claim and a relation have a page at the path of their identifier in the JSON-LD
  file (ADR 0015). When the operator hosts the site at the base of the identifiers, each
  identifier opens its page. The page of a relation sends the reader to the page of its claim.
- The address of an entity that a merge absorbed gives a page that sends the reader to the
  survivor (ADR 0014), so an old citation still opens a page.
- A vessel with an IMO number of seven digits also has a page at the path of its number, under
  `vessel/`. The number names the ship for its whole life, through a new name, a new flag and a
  merge, so the address does not change when the record changes. The join reads the number with
  the rule of the alignment matrix (ADR 0017). A number with a wrong check digit still has its
  page, and the page says that the digit is wrong.
- Two public vessels with one IMO number and no merge share the page of the number, and the page
  gives the timeline of each vessel apart. The page does not join them, because only the operator
  merges (ADR 0014). A merged vessel has one page, and the page names each absorbed identifier.
- The page of a vessel draws a timeline of its former names, flags, owners, managers and
  operators, insurers, designations and port calls, from the bounds of the relations and the
  dated claims of the release. The release renders the drawing as SVG, with no script. A bound
  with no end is open: its bar goes to the line of the version, with an arrow, and it never reads
  as ended. A bound with no start reads as unknown. A list in words gives each mark, also the
  marks with no date, for a screen reader and for a small screen. Each mark links to its claim,
  and an end date that an act gave (ADR 0021) links to the claim of that act.
- A page is a folder with an index file, and each link is relative and names the index file. So
  the site works under any base path, and its pages open from the files on a disk.
- Each page says "Version of DD/MM/YYYY" and gives the two contact links of the release manifest.
  No page says that the data is live.
- The NATO pair shows only when the release shows it (ADR 0016): next to each claim, and with its
  explanation on the method page. Off, no page holds a letter, a digit or the name of the pair.

### The map

- MapLibre (ADR 0005) draws the entities of the GeoJSON file of the release over a basemap that is
  a file of the site: the outlines of the countries, from Natural Earth (public domain), simplified
  at 110 m. A tile server needs a host or a key, and the tile policy of OpenStreetMap does not
  permit a public application, so the site uses no tile server. The GeoJSON is in the page, so the
  map sends no request for data.
- The map is a dark globe: the globe projection of MapLibre, with no new dependency. The globe
  turns slowly until the reader acts, and a light pulse runs along each link that is a fact, so the
  reader sees the direction of the flow. The map block takes the dark tokens of the stylesheet, and
  the hues of the stages and the products are light ones for that ground.
- The colour of a point is one of the six stages of the chain: field, upstream transport,
  refining and liquefaction, and export come from the asset kind of the asset; the exit from
  Russian control and the declared destination come from the relations. An asset outside Russia at
  the far end of an accepted physical link from an asset in Russia is a declared destination. So is
  a place outside Russia where a vessel discharges (an accepted `discharges_at`), when the vessel
  has an accepted `loads_at` at a place in Russia. The
  card and the table give the same stage.
- A strip of six steps tells the chain from the well to the exit: extraction, pipeline, refinery,
  terminal, export (the links after the export stage and the declared destinations) and exit. A
  step puts its assets or its links forward, moves the camera to them, and gives one sentence.
  "Play the chain" goes through the steps. A step counts accepted facts only.
- The long text that tells how to read the map is in a panel that the reader opens, so the map
  is the first thing the reader sees.
- A physical link is an arc with the colour of its product: the relation type of the link gives
  the product, and one map of the code holds the type of each product for the release and the
  map. A filter shows one product chain.
- An exit point is computed from the relations, and is not an entity of the record: a loading at a
  port with a position in Russia (a sale at a Russian port), a ship-to-ship transfer, or a
  physical link from an asset with a position in Russia to an asset with a position outside Russia
  (a handover at the border). An asset with no position gives no exit point, because the map
  cannot tell that it is in Russia.
- The line of an arc shows its volume from the volumes table (ADR 0013). An observed flow is a full
  line, and its width grows with its value against the flows of the same unit only. An estimate is
  hatched on a pale halo of its range. A capacity is a thin hollow line. A link with no volume has
  one width, and is dashed after the export stage.
- A fact in review is shown, and never as a fact. The card of an asset gives the accepted facts
  first, then each fact in review, marked "In review" in words. A link in review is a grey dotted
  line labelled "in review", and each of its volumes is marked in review. An exit point in review
  is a grey ring, and its card says "In review". A count of the page counts the accepted facts.
- A click that hits more than one point lists each point, and the reader chooses one. The address
  keeps the product chain and the step, so a reload keeps them.
- When the reader asks for reduced motion, the globe does not turn, no pulse runs, the camera
  jumps, and "Play the chain" goes one step for each press. A browser with no WebGL gets one
  sentence in place of the map, and the list of the entities stays.
- The chain logic (the stages, the products, the arcs, the exit points, the steps and the outlines
  of the countries) is in the shared package that the application imports too, so the two surfaces
  compute the same chain. The site keeps the volumes and the release reader.
- The map script and MapLibre are files of the site. MapLibre loads its worker as a module beside
  it, so the map needs a host: from the files on a disk, the map page shows the list of the
  entities with a position, and no map.

### The old site

The operator can give the folder of the build of version 1. The release copies it under `v1/`, and
its demonstration project also to the root of the site.
With none, the address `v1/` gives a page that says that this copy holds no build of version 1.

## Alternatives

- **The hosted read API and the application.** A server, a cost and an attack surface for data
  that changes only at each release. Refused.
- **A site that reads the JSON-LD file in the browser.** A page with no script is faster, a search
  engine reads it, and it opens from a disk. Refused.
- **A second, small stylesheet for the site.** A second palette drifts from the first. Refused.
- **A basemap from a tile server.** A key, a cost, or a breach of a tile policy. Refused.
- **The site inside the release folder.** The deposit of a release would hold each file two
  times. Refused.

## Cost

- The release command needs the development dependencies (Vite, Tailwind) on the machine of the
  operator. The release writes the site before its folder takes its name, so a site that fails
  leaves no release folder.
- The site builds a page for each entity and each claim, in memory. A record many times larger
  needs a writer that streams.
- The basemap shows the coast and the borders only. It shows no road, no town and no relief.
- MapLibre parses no oklch colour and no CSS custom property, so the hues of the stages and of the
  products are hex values in the code of the map, outside the stylesheet.
- The pulse sets a paint property of the map at each frame. It costs a small part of the processor
  while the page is in view.
- A document, the release and the vocabulary have no page, so their identifiers open no page.
- A vessel with no IMO number has no timeline page. Its entity page gives its relations.
- The timeline draws only the dates that the sources give (`decisions.md` M5). A port call and a
  false flag take their day from their `observed_on` value, or else from another value of the
  relation that is a day. A former name and a flag value have no date.
- A relation counts only when the vessel is at its expected end: the second end of an owner, an
  operator, an insurer and a flag, and the first end of a designation, a port call and a false
  flag.
- The build of version 1 reads its demonstration project at the root of the host, so the release
  copies that project to the root of the site too. Version 1 works only when the site is at the
  root of its host, or when the host sends the root address of the project to `v1/`.
- A page address is a folder. The host must send the address of a folder with no final slash to
  the same address with the slash, or the relative links of the page break.
- A quoted passage can hold the word "live". The test checks the pages of a fixed release.
