# ADR 0028 — One site: the application, which hides each part that needs a backend

**Status** Accepted · 18 October 2026
**Supersedes** ADR 0020.

## Context

ADR 0020 made two surfaces: a static site that each release writes (the critical nodes table, the
globe map, a page for each entity and each claim, the downloads, the method) and the application
of the operator (the map, the graph, the search, the review). The two surfaces have two sets of
pages, two maps and two navigations, and a visitor sees only one of them.

The operator wants one site with all the pages (`decisions.md` PU1, 18 October 2026). The parts
that need a backend show only when the backend answers.

## Decision

### One application

- The public site is the application. There is no second set of pages. Each page of the static
  site becomes a page of the application: the critical nodes table, the globe map with the chain,
  the downloads, the method, the page of a claim and the page of a vessel.
- Each permanent address of ADR 0020 stays the same: an entity, a claim and a relation at the path
  of their identifier, a vessel at the path of its IMO number. A citation that a reader made before
  this change still opens its page.

### The application finds its mode from the services

- The application asks the read service and the write service if they answer.
- **Read service down:** the application reads the files of the release that it was built with.
  It shows the record of that release, and each page says "Version of DD/MM/YYYY", as ADR 0020
  required. No page says that the data is live.
- **Write service down:** each part that writes is hidden: the review, the button that creates an
  entity, the edit bar, the extraction, the upload and the lead. A direct visit to the address of
  the review gives one short page that says the page is not available. This part is built
  already (the read-only work of the application, 18 October 2026).
- **Both services up:** the operator sees every part, as today.
- The mode comes from the answer of the services only. There is no build flag and no second build.

### The release

- The release command builds the application once, with the files of the release beside it, and
  writes the result in the folder of the site. Each page at a permanent address is rendered to HTML
  at the release, so the text of a page opens with no script, a search engine reads it, and a
  static host with no rewrite rule serves it.
- The rules of ADR 0020 that are not about two surfaces stay true: the site is a pure function of
  the files of the release, it holds a copy of each file byte for byte, the basemap is a file of the
  site, and no page sends a request for data to a third host.
- The rule of ADR 0020 that the site holds no script except the map script ends. A page at a
  permanent address keeps its text with no script, and the other pages need one.

## Reasons

- One set of pages: one design, one map, one navigation. A fix lands on one page and not on two.
- The public host stays a static host. There is no hosted database and no hosted API, so there is
  no monthly cost and no server that an attacker can reach, as in ADR 0020.
- The operator runs the same site on the PC, with the backend, and sees the parts that write.

## Cost

- The pages of the static site move into the application, and the two maps become one. This is
  the largest part of the work.
- The application must read the record from the files of a release, through the same shapes that
  it reads from the read service. A test checks that the two reads give the same pages.
- A page at a permanent address needs a render at the release. A page of the application that has
  no permanent address (the graph, the search) needs a script.
- The files of a release hold the own point of an entity, and no precision word and no row-level
  source list. A page that reads the files shows the same claims, relations and sources, but the
  map draws own points only and cannot borrow the point of a parent.
- The move is done (18 October 2026). The release builds the application and no longer writes the
  static site of ADR 0020. The code of the static pages, the map script and the second style
  sheet are deleted. The release command no longer copies a build of the version 1 map: the old
  address of that map gives a short page that links the critical nodes.
