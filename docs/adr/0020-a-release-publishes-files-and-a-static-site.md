# ADR 0020 — A release publishes files and a static site, with no public API

**Status** Accepted · 10 October 2026
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
- A page is a folder with an index file, and each link is relative and names the index file. So
  the site works under any base path, and its pages open from the files on a disk.
- Each page says "Version of DD/MM/YYYY" and gives the two contact links of the release manifest.
  No page says that the data is live.
- The NATO pair shows only when the release shows it (ADR 0016): next to each claim, and with its
  explanation on the method page. Off, no page holds a letter, a digit or the name of the pair.

### The map

- MapLibre (ADR 0005) draws the entities of the GeoJSON file of the release over a plain ground
  with lines of latitude and longitude, and with no basemap. A tile server needs a host or a key,
  and the tile policy of OpenStreetMap does not permit a public application. The GeoJSON is in the
  page, so the map sends no request for data.
- The map script and MapLibre are files of the site. MapLibre loads its worker as a module beside
  it, so the map needs a host: from the files on a disk, the map page shows the list of the
  entities with a position, and no map.

### The old site

The operator can give the folder of the build of version 1. The release copies it under `v1/`.
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
  operator.
- The site builds a page for each entity and each claim, in memory. A record many times larger
  needs a writer that streams.
- With no basemap, a reader sees the points and the grid only.
- A document, the release and the vocabulary have no page, so their identifiers open no page.
- The build of version 1 reads its demonstration file at the root of the host. Under `v1/` it does
  not find the file until version 1 reads it from its own base path.
- A quoted passage can hold the word "live". The test checks the pages of a fixed release.
