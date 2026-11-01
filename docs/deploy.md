# Deploy: the files for crawlers and readers

This document tells what a release site holds besides its pages, and what the operator sets. It
is a how-to guide: it names the variables and the files that the operator types or reads.

## What a release writes

The release command writes the site in a hidden folder and renames it at the end. At the root of
the site folder it writes:

- `robots.txt`. It allows each page and each file. It names the known AI crawlers with the policy
  of the operator. It points to the sitemap.
- `sitemap.xml`, and `sitemap-N.xml` files when the list is longer than one file of the standard
  (50,000 addresses or 50 MB). `sitemap.xml` is then the index. Each address is absolute, and the
  last-modified date is the date of the release. The sitemap lists the pages that a search result
  may hold. It does not list a page with no data (the graph and the search), a relation page or
  a merged entity (both send the reader to another page).
- `llms.txt`: what the site is, the main pages, the files of the release and how to cite them.
- The icons, the web manifest and the preview image, which the application build copies from
  `public/`.

Each page also holds its title, description, canonical address, preview tags and structured data
in the HTML, with no script. The home page and the downloads page hold a schema.org `Dataset`.

## What the operator sets

- The public address: the `iriBase` of the release manifest. The origin of the address starts
  each absolute address. A release with no usable `iriBase` writes no sitemap, no `llms.txt`, no
  canonical address and no preview tag, and the command prints why. `robots.txt` is still written.
- `SITE_BASE`: the folder of the host where the site stands, as `/gab/`. The addresses then
  start with the origin and this folder. A search engine reads `robots.txt` only at the root of
  a host, so copy that file there when the site is in a folder.
- `SITE_RELEASE`: set it to `1` only for the build of a release that goes to `main`. With no
  value, the build is a staging build: each page holds a noindex tag, and the sitemap lists no
  page. So a staging site never goes into a search result.

## Release checklist

A pull request into `main` refers to this list, and each item must be done before the merge. The
contract of the report holds three blockers:

- [ ] A written legal review of the report and of each data layer that the release shows. A layer
      that the review does not cover stays off.
- [ ] A documented right of reply: each party that the report names received the claims about it
      and a date to reply, and the file keeps each reply or the lack of one.
- [ ] A Corrections page on the site, with a contact address that a reader can use to ask for a
      correction.

Then build the site with `SITE_RELEASE=1`, and check that a page holds no noindex tag.

## How to change the policy for AI systems

Open `packages/release/src/ai-policy.ts` and change the value of `AI_CRAWLER_POLICY`:

- `allow` (default): an AI system may read the site and must cite the claim that it uses.
- `disallow`: `robots.txt` disallows the known AI crawlers.

The same value writes `robots.txt`, `llms.txt` and the words of the page "AI use", so they agree.
`robots.txt` is a request: a crawler can ignore it. To add a crawler, add its user agent to the
list in the same file.

## How to check a release

Open `robots.txt`, `sitemap.xml` and `llms.txt` on the built site. Check a page with a public
validator for the structured data of a `Dataset`, and check the manifest with a validator of web
manifests. The unit tests of the site writer check the same files on a rendered release.
