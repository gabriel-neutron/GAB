"""Render the report: one self-contained HTML page and one A4 PDF from one Markdown file.

    python tools/report/report.py INPUT.md --figures DIR --out DIR [--draft] [--name NAME]

The files are OUT/NAME.html and OUT/NAME.pdf. NAME defaults to the stem of INPUT.

The input is French Markdown. The title page comes from a front matter block (`---`, then
`key: value` lines: title, subtitle, author, date, version) or from the head of the text (a `#`
title, a `##` subtitle, the lines `Auteur : …`, `Date : …`, `Version : …`). A footnote is `[^n]`
with its definition `[^n]: text` anywhere in the file. A figure is an image block, then its
caption paragraph ("Figure n. …"); a table caption comes before the table. A figure file is
found by the stem of its image path, in DIR, as SVG first and PNG second. A block quote is an
assessment block of the authors: its first bold run is its label. Fenced code is not supported.

Colours and fonts come from the `:root` block of `src/index.css`. The PDF engine is WeasyPrint:
it puts real footnotes at the foot of the page, which a browser print cannot do. It needs the
Pango library (Debian: `apt-get install libpango-1.0-0 libpangoft2-1.0-0`).

A figure whose image alt text starts with `side: ` floats right at about 81 mm and the text goes on beside it; a float that moves to the next page goes back into the flow at full width. `--theme-css PATH` reads a CSS file after the report CSS.

Redesign layout. The front matter keys `layout: redesign` and `bibliography: FILE` (a JSON file next to
the input) switch on: numbered references, a cover with the date and the working-version line, a table of contents (parts, figure list) after the cover, the badge line, an
annex section type, side-by-side panels and the funding sentence once at the end.
- A reference is `[@key]` or `[@key1; @key2]`. It prints as `[n]`, numbered by first use, linked to the
  entry of the bibliography; in a table it prints as a superscript number. The bibliography file is a JSON
  object: key -> {publisher, title, date, url, accessed, page?}. An unknown key, a missing field or a
  `doc_` identifier in the output stops the build.
- The bibliography is optional. Without the `bibliography:` key, the report has no bibliography section and
  a source is a normal footnote `[^label]`, at the foot of the page, numbered in one sequence for the whole report.
- A claim badge is `{{Établi}}`, `{{Probable}}`, `{{Indicatif}}` or `{{Non établi}}`, after a material
  claim. It is a symbol plus a letter, so it reads in grey print. Its names print as one line at the foot of the contents.
- A section titled "Chiffres clés" is a page of its own. A section titled "Annexe A. …" is an annex.
- Two images before one caption stand side by side, at one height, when their natural widths fit the text block.
- A caption of the redesign holds the title, the unit and the footnote marks of its source line; the text of
  the source line does not print (the page foot carries it). A "Note :" part stays. A title of more than 8 words
  gets a warning. Figure numbers and table numbers must rise in order of appearance (the build stops
  otherwise). A section that is not an annex or the key figures must not start or end with a figure or a table: the build stops and names the section. Two figures or tables with fewer than 5 lines of text between them get a warning. A figure that
  no earlier text calls gets a warning.

With --draft, an open marker shows in a highlight and the last page lists it. Without it, an open
marker stops the build: the final build carries none.
"""
import argparse
import base64
import html
import json
import re
import sys
from pathlib import Path

import markdown

HERE = Path(__file__).parent
SITE_CSS = HERE.parents[1] / "src" / "index.css"
FUNDING = ("This investigation was supported by FNF through the OSINT+ Investigation Competition 2026. "
           "The author(s) are solely responsible for the content and conclusions presented.")
NOTES_HEADING = "Sources par note"
FUNDING_HEADING = "Financement"
RESERVED = "À écrire par le co-auteur"
OPEN_MARKER = (r"\[(?:À STOCKER|À CONFIRMER|LIEN JEU DE DONNÉES|TABLE DE CORRESPONDANCE EN ATTENTE)[^\]]*\]"
               rf"|{RESERVED}")
CONFIDENCE = {"Établi": "●●●", "Probable": "●●○", "Indicatif": "●○○", "Non établi": "○○○"}
DOC_ID = re.compile(r"doc_[0-9A-Za-z]+")
BIB_FIELDS = ("publisher", "title", "date", "url", "accessed")
KEY_FIGURES = "Chiffres clés"
TOC_HEADING = "Sommaire"
BIB_HEADING = "Bibliographie"
# Badge: a shape (the first cue) and a letter (the second cue), both in ink, so grey print keeps them.
RING = '<circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.2"'
BADGES = {
    "Établi": ("E", '<circle cx="5" cy="5" r="4" fill="currentColor"/>', "confirmé par deux sources indépendantes"),
    "Probable": ("P", RING + '/><path d="M5 1.4a3.6 3.6 0 0 0 0 7.2z" fill="currentColor"/>',
                 "une source solide, ou des sources qui se recoupent"),
    "Indicatif": ("I", RING + "/>", "un indice, ou une source faible"),
    "Non établi": ("N", RING + ' stroke-dasharray="1.6 1.4"/>', "aucune source stockée ne le porte"),
}
TOKENS = ("background", "foreground", "muted", "muted-foreground", "label", "border", "input")
PAGE_MM, GUTTER_MM = 166, 4  # width of the text block of the A4 page; gap between two side-by-side figures
SIDE_ALT = "side: "  # alt text that makes a figure float right beside the text (about 81 mm wide)
TITLE_WORDS = 8  # longest short title of a figure or a table before the build warns
NBSP, THIN = " ", " "


class ReportError(ValueError):
    """The input breaks a rule of the report."""


def natural_mm(svg):
    """Width in mm of a figure drawn at its printed size. The figure tool writes pt; a handmade figure has a viewBox in mm."""
    if not svg.exists():
        return PAGE_MM
    found = re.search(r"<svg[^>]*>", svg.read_text(encoding="utf-8"))
    if not found:
        return PAGE_MM
    head = found.group(0)
    width = re.search(r'\swidth="([\d.]+)pt"', head)
    if width:
        return float(width.group(1)) * 25.4 / 72
    box = re.search(r'viewBox="[\d.]+ [\d.]+ ([\d.]+) [\d.]+"', head)
    return min(float(box.group(1)), PAGE_MM) if box else PAGE_MM


def aspect_of(path):
    """Width over height of a figure file (SVG first, else the PNG header)."""
    svg = path.with_suffix(".svg")
    if svg.exists():
        head = re.search(r"<svg[^>]*>", svg.read_text(encoding="utf-8"))
        head = head.group(0) if head else ""
        w, h = (re.search(rf'\s{k}="([\d.]+)(?:pt)?"', head) for k in ("width", "height"))
        if w and h:
            return float(w[1]) / float(h[1])
        box = re.search(r'viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"', head)
        if box:
            return float(box[1]) / float(box[2])
    png = path.with_suffix(".png")
    data = png.read_bytes()[:24] if png.exists() else b""
    return int.from_bytes(data[16:20], "big") / int.from_bytes(data[20:24], "big") if data[12:16] == b"IHDR" else 1.0


def site_tokens():
    """The light-theme tokens of the site stylesheet, as hex colours."""
    sys.path.insert(0, str(HERE.parent / "figures"))
    from style import oklch
    block = re.search(r"^:root\s*\{(.*?)^\}", SITE_CSS.read_text(encoding="utf-8"), re.S | re.M)
    found = dict(re.findall(r"^\s*--([a-z-]+):\s*(oklch\([^)]*\))", block.group(1), re.M)) if block else {}
    missing = [k for k in TOKENS if k not in found]
    if missing:
        raise ReportError(f"the site stylesheet has no oklch token for: {', '.join(missing)}")
    return {k: oklch(found[k]) for k in TOKENS}


def front_matter(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return {}, text
    meta = dict(re.findall(r"^([A-Za-z]+):[ \t]*(.*)$", m.group(1), re.M))
    return meta, text[m.end():]


def head_meta(blocks):
    """The title page fields from the blocks before the first numbered section."""
    meta, i = {}, next((i for i, b in enumerate(blocks) if re.match(rf"##\s+(\d|{KEY_FIGURES})", b)), 0)
    kept = []
    for b in blocks[:i]:
        if not (b.startswith("#") or re.match(r"(Auteurs?|Authors?|Date|Version)\s*:", b, re.I) or re.fullmatch(r"\*[^*]+\*", b)):
            kept.append(b)
        if b.startswith("# "):
            meta["title"] = b[2:].strip()
        elif b.startswith("## "):
            meta.setdefault("subtitle", b[3:].strip())
        for key, value in re.findall(r"^(Auteurs?|Authors?|Date|Version)\s*:\s*(.+)$", b, re.M | re.I):
            meta[{"auteurs": "author", "authors": "author", "auteur": "author"}.get(key.lower(), key.lower())] = value.strip()
    return meta, kept + blocks[i:]


def french(text):
    """French typography of one text node: no break before ; ! ? : » % or inside 1 000."""
    text = re.sub(r" +([;!?»%])", THIN + r"\1", text)
    text = re.sub(r" +:", NBSP + ":", text)
    text = re.sub(r"« +", "«" + THIN, text)
    text = re.sub(r"(?<!\d)(\d{1,3}) (?=\d{3}\b)", r"\1" + THIN, text)
    return re.sub(r"(?<=\w)'(?=\w)", "’", text)


def badge_html(level):
    letter, shape, _ = BADGES[level]
    return (f'<span class="badge" title="{level}"><svg viewBox="0 0 10 10" width="9" height="9" '
            f'aria-hidden="true">{shape}</svg><span class="bl">{letter}</span></span>')


FIG_START = re.compile(r"\**(Figure|Tableau)\s+\S+?\.(?=\s|\*|$)")
LINE_CHARS, GAP_LINES = 95, 5  # characters of a printed line of the text block; lines of text that keep two figures apart


def placement(body):
    """The blocks of a section as ('fig' | 'text', lines of text). A figure is its images and caption; a table is its caption and rows."""
    out, i, plates = [], 0, False
    while i < len(body):
        b, i = body[i], i + 1
        if re.fullmatch(r"!\[[^\]]*\]\([^)]+\)", b):
            if not plates:
                out.append(("fig", 0))
            plates = True
            # an image with no caption still counts: the build stops later with "a figure has no caption"
        elif FIG_START.match(b):
            if not plates and i < len(body) and body[i].startswith("|"):
                i += 1
            if not plates:
                out.append(("fig", 0))
            plates = False
        elif b.startswith("|"):
            out.append(("fig", 0))
        else:
            out.append(("text", 1 if b.startswith("#") else -(-len(b) // LINE_CHARS)))
    return out


def check_placement(title, body):
    """A figure or a table never opens or closes a section (error); two within GAP_LINES lines of text get a warning."""
    items = placement(body)
    if items[0][0] == "fig":
        raise ReportError(f"section {title!r} starts with a figure or a table: start with text")
    if items[-1][0] == "fig":
        raise ReportError(f"section {title!r} ends with a figure or a table: end with text")
    gap = None
    for kind, lines in items:
        if kind == "fig":
            if gap is not None and gap < GAP_LINES:
                print(f"warning: section {title!r}: two figures or tables are {gap} lines of text apart (fewer than {GAP_LINES}): they look related", file=sys.stderr)
            gap = 0
        elif gap is not None:
            gap += lines


class Doc:
    def __init__(self, notes, draft, figures, redesign=False, bibliography=None):
        self.notes, self.draft, self.figures = notes, draft, Path(figures)
        self.redesign, self.bib = redesign, bibliography or {}
        self.refs, self.badges_used, self.in_table = {}, False, False
        self.order, self.note_html, self.uses = {}, {}, {}
        self.section_notes, self.open, self.section = [], [], ""
        self.last_number, self.prose = {}, []
        self.listed, self.heads = [], 0  # (label, short title, anchor) of each figure; count of h3 anchors

    def md(self, text):
        return markdown.markdown(text, extensions=["tables"])

    def inline(self, text):
        return re.sub(r"^<p>|</p>$", "", self.md(text))

    def dress(self, fragment, marks=True):
        """Typography, open markers, confidence marks and identifiers, in the text nodes only."""
        pattern = re.compile(rf"(?P<m>{OPEN_MARKER})|(?P<c>\b(?:Non établi|Établi|Probable|Indicatif)\b)"
                             r"|(?P<d>\bdoc_[0-9a-f]{12}\b)")

        def sub(m):
            if m["m"]:
                n = len(self.open) + 1
                self.open.append((n, m["m"], self.section))
                return f'<mark class="open" id="op-{n}">{m["m"]}</mark>' if self.draft else m["m"]
            if m["c"] and (not marks or self.redesign):
                return m["c"]
            if m["c"]:
                return f'<span class="cw"><span class="pips" aria-hidden="true">{CONFIDENCE[m["c"]]}</span> {m["c"]}</span>'
            return f'<code class="id">{m["d"]}</code>'

        parts = re.split(r"(<[^>]*>)", fragment)
        for i in range(0, len(parts), 2):
            parts[i] = pattern.sub(sub, french(parts[i]))
        return "".join(parts)

    def cite(self, match):
        label = match["label"]
        if label not in self.notes:
            raise ReportError(f"footnote {label} has no definition")
        first = label not in self.order
        if first:
            self.order[label] = len(self.order) + 1
            self.refuse_marks(self.notes[label])
            self.note_html[self.order[label]] = self.dress(self.inline(self.notes[label]))
            self.section_notes[-1].append(self.order[label])
        k = self.order[label]
        self.uses[k] = self.uses.get(k, 0) + 1
        return f"@@{'F' if first else 'R'}{k}.{self.uses[k]}@@"

    def refuse_marks(self, text):
        """A reference or a badge that is not resolved must not print as raw text."""
        if self.redesign and re.search(r"\[@|\{\{", text):
            raise ReportError(f"a reference or a badge is not allowed here (heading, note) or is not valid: {text[:60]}")

    def reference(self, match):
        """One `[@key; @key]` group as [n] links, or as superscript numbers in a table."""
        nums = []
        for key in re.findall(r"[\w.-]+", match["keys"]):
            if key not in self.bib:
                raise ReportError(f"reference {key} is not in the bibliography")
            nums.append(self.refs.setdefault(key, len(self.refs) + 1))
        links = ", ".join(f'<a class="ref" href="#ref-{n}">{n}</a>' for n in nums)
        return f'<sup class="refs">{links}</sup>' if self.in_table else f"[{links}]"

    def badge(self, match):
        if match["level"] not in BADGES:
            raise ReportError(f"unknown badge level: {match['level']}")
        self.badges_used = True
        return badge_html(match["level"])

    def text(self, source):
        """Markdown to dressed HTML, with the footnote, reference and badge marks as tokens."""
        if self.redesign:
            parts = re.split(r"(`[^`\n]*`)", source)  # a code span keeps its text
            for i in range(0, len(parts), 2):
                parts[i] = re.sub(r"\[(@[\w.-]+(?:\s*;\s*@[\w.-]+)*)\]",
                                  lambda m: f"@@REF:{m[1].replace('@', '')}@@", parts[i])
                parts[i] = re.sub(r"\{\{([^}]+)\}\}", r"@@BADGE:\1@@", parts[i])
                self.refuse_marks(parts[i])
            source = "".join(parts)
        out = self.dress(self.md(re.sub(r"\[\^([^\]]+)\]", r"@@FN:\1@@", source)))
        out = re.sub(r"@@FN:(?P<label>[^@]+)@@", self.cite, out)
        out = re.sub(r"@@REF:(?P<keys>[^@]+)@@", self.reference, out)
        return re.sub(r"@@BADGE:(?P<level>[^@]+)@@", self.badge, out)

    def image(self, block):
        """The image as (alt, data URI, width in mm, width over height)."""
        alt, path = re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", block).groups()
        stem = Path(path).stem
        for ext, mime in ((".svg", "image/svg+xml"), (".png", "image/png")):
            if (self.figures / (stem + ext)).exists():
                data = base64.b64encode((self.figures / (stem + ext)).read_bytes()).decode()
                mm = natural_mm(self.figures / (stem + ".svg"))
                return (html.escape(alt), f"data:{mime};base64,{data}", mm, aspect_of(self.figures / (stem + ext)))
        raise ReportError(f"figure file not found: {stem}.svg or {stem}.png in {self.figures}")

    def anchor(self):
        """The id that the figure list links to: the caption just listed."""
        return f' id="fig-{len(self.listed)}"' if self.redesign else ""

    def caption(self, block):
        raw = block.replace("**", "")
        label, rest = re.match(r"((?:Figure|Tableau)\s+\S+?\.)\s*(.*)$", raw, re.S).groups()
        title, tail = (re.split(r"\s(?=Sources?\s?:)", rest, maxsplit=1) + [""])[:2]
        if not self.redesign:
            return self.text(f"**{label} {title}** {tail}").replace("<p>", '<p class="caption">', 1)
        self.check_caption(label, title)
        short = re.sub(r"\s*\((?:[^()]|\([^()]*\))*\)\.?\s*$", "", title).rstrip(". ")
        self.listed.append((label.rstrip("."), short, f"fig-{len(self.listed) + 1}"))
        label = re.sub(r"^(\w+)\s+(\S+?)\.$", r'\1 <span class="fnum">\2.</span>', label)
        source, _, note = tail.partition("Note :")
        marks = re.findall(r"\[\^[^\]]+\]|\[@[^\]]+\]", source)
        self.in_table = True  # a reference prints as a superscript number, as in a table
        try:
            out = self.text(f"**{label} {title}**" + "<sup>,</sup>".join(marks) + (f" Note : {note.strip()}" if note.strip() else ""))
        finally:
            self.in_table = False
        return out.replace("<p>", '<p class="caption">', 1)

    def check_caption(self, label, title):
        """Numbers rise in order of appearance; a long title and a figure no text calls get a warning."""
        kind, number = label.rstrip(".").split()
        if number.isdigit():
            if int(number) <= self.last_number.get(kind, 0):
                raise ReportError(f"{kind} {number} comes after {kind} {self.last_number[kind]}: numbers must rise in order of appearance")
            self.last_number[kind] = int(number)
            if kind == "Figure" and not re.search(rf"\bfigure {number}\b", " ".join(self.prose), re.I):
                print(f"warning: figure {number} is not called by any earlier text", file=sys.stderr)
        short = re.sub(r"\s*\((?:[^()]|\([^()]*\))*\)\.?\s*$", "", title)
        if len(short.split()) > TITLE_WORDS:
            print(f"warning: the title of {kind.lower()} {number} has {len(short.split())} words (more than {TITLE_WORDS}): {short}", file=sys.stderr)

    def plates_html(self, plates):
        """The figure tag: one image at its own width, or a row at one height when the natural widths fit."""
        side = self.redesign and len(plates) > 1 and sum(p[2] for p in plates) <= PAGE_MM + GUTTER_MM
        if side:
            height = min(min(p[2] / p[3] for p in plates), (PAGE_MM - GUTTER_MM * (len(plates) - 1)) / sum(p[3] for p in plates))
            plates = [(a, u, height * r, r) for a, u, _, r in plates]
        imgs = "".join(f'<img alt="{a}" style="--w:{mm:.1f}mm" src="{u}">' for a, u, mm, _ in plates)
        return side, f'<div class="plates">{imgs}</div>'

    def table(self, block):
        def cell(m):
            plain = re.sub(r"@@[^@]*@@", "", re.sub(r"<[^>]*>", "", re.sub(r'<sup class="refs">.*?</sup>', "", m["body"]))).strip()
            numeric = re.fullmatch(r"[\d\s.,%  –-]+|\d{4}-\d{2}-\d{2}", plain)
            return f'<td class="num mono">{m["body"]}</td>' if numeric else f'<td>{m["body"]}</td>'
        self.in_table = True
        try:
            out = re.sub(r'<td(?: [^>]*)?>(?P<body>.*?)</td>', cell, self.text(block), flags=re.S)
        finally:
            self.in_table = False
        return f'<div class="tablewrap">{out}</div>'

    def blocks(self, blocks):
        """The HTML of the blocks of one section."""
        out, plates, i = [], [], 0
        while i < len(blocks):
            b = blocks[i]
            i += 1
            if re.fullmatch(r"!\[[^\]]*\]\([^)]+\)", b):
                plates.append(self.image(b))
            elif re.match(r"\**(Figure|Tableau)\s+\S+?\.(?=\s|\*|$)", b):
                if plates:
                    floated = len(plates) == 1 and plates[0][0].startswith(SIDE_ALT)
                    if floated:
                        plates = [(plates[0][0][len(SIDE_ALT):], *plates[0][1:])]
                    side, row = self.plates_html(plates)
                    cap = self.caption(b)
                    out.append(f'<figure class="fig{" panels" if side else ""}{" side" if floated else ""}"{self.anchor()}>{row}{cap}</figure>')
                    plates = []
                elif i < len(blocks) and blocks[i].startswith("|"):
                    cap = self.caption(b)
                    out.append(f'<div class="tablebox"{self.anchor()}>{cap}{self.table(blocks[i])}</div>')
                    i += 1
                else:
                    cap = self.caption(b)
                    out.append(f"<div{self.anchor()}>{cap}</div>" if self.redesign else cap)
            else:
                if plates:
                    raise ReportError("a figure has no caption")
                self.prose.append(b)
                out.append(self.block(b))
        if plates:
            raise ReportError("a figure has no caption")
        return "".join(out)

    def block(self, b):
        if m := re.match(r"(#{3,6})\s+(?:(\d+(?:\.\d+)*\.?)\s+)?(.*)", b):
            level, num, title = len(m[1]), m[2], m[3]
            self.refuse_marks(title)
            self.heads += level == 3
            anchor = f' id="h{self.heads}"' if level == 3 else ""
            return f'<h{level}{anchor}>{f"<span class=num>{num}</span> " if num else ""}{self.dress(self.inline(title), False)}</h{level}>'
        if b.startswith("|"):
            return self.table(b)
        if b.startswith(">"):
            inner = "\n".join(re.sub(r"^>\s?", "", line) for line in b.splitlines())
            return f'<aside class="assessment">{self.text(inner)}</aside>'
        if b.startswith("**Encadré"):
            return f'<aside class="box">{self.text(b)}</aside>'
        return self.text(b)

    def sections(self, blocks):
        """Split at the second-level headings; return a list of (title, html, notes, reserved, kind, label)."""
        groups = [[None, None, []]]
        for b in blocks:
            if m := re.match(r"##\s+(?:(\d+)\.?\s+)?(.*)", b):
                groups.append([m[1], m[2], []])
            else:
                groups[-1][2].append(b)
        if self.redesign:  # reference numbers follow the order of print: annexes come last
            groups[1:] = sorted(groups[1:], key=lambda g: bool(re.match(r"Annexe\b", g[1] or "")))
        out = []
        for num, title, body in groups:
            self.refuse_marks(title or "")
            if title == NOTES_HEADING or (title is None and not body):
                continue
            self.section = f"{num}. {title}" if num else (title or "")
            self.section_notes.append([])
            heading = "" if title is None else f'<h2>{f"<span class=num>{num}.</span> " if num else ""}{self.dress(self.inline(title), False)}</h2>'
            if self.redesign and body and title not in (KEY_FIGURES, None) and not re.match(r"Annexe\b", title):
                check_placement(title, body)
            inner = self.blocks(body)
            kind = "annex" if self.redesign and re.match(r"Annexe\b", title or "") else (
                "keyfigures" if self.redesign and title == KEY_FIGURES else "")
            out.append((title, heading + inner, self.section_notes[-1], RESERVED in "\n".join(body), kind, self.section))
        return out


def finish(sections, doc, mode):
    """The body of one output: footnote marks as page-foot notes (pdf) or as links (html)."""
    out = []
    for i, (title, body, notes, reserved, kind, _) in enumerate(sections):
        def mark(m):
            kind, k, n = m[1], int(m[2]), m[3]
            if mode == "pdf":
                return f'<span class="fn">{doc.note_html[k]}</span>' if kind == "F" else f'<sup class="again">{k}</sup>'
            return f'<sup class="fn"><a id="fnref-{k}-{n}" href="#fn-{k}">{k}</a></sup>'
        body = re.sub(r"@@([FR])(\d+)\.(\d+)@@", mark, body)
        if mode == "html" and notes:
            items = "".join(f'<li id="fn-{k}">{doc.note_html[k]} ' + "".join(
                f'<a class="back" href="#fnref-{k}-{n}">↩</a>' for n in range(1, doc.uses[k] + 1)) + "</li>" for k in notes)
            body += f'<ol class="notes" start="{notes[0]}">{items}</ol>'
        cls = " ".join(c for c, on in (("reserved", reserved), ("funding", title == FUNDING_HEADING), ("conclusion", bool(re.match(r"Conclusion\b", title or ""))), (kind, kind)) if on)
        out.append(f'<section id="s{i}" class="{cls}">{body}</section>')
    return "".join(out)


def bibliography_section(doc):
    """The bibliography, numbered in the order of the first citation."""
    items = []
    for key, n in doc.refs.items():
        b = doc.bib[key]
        page = f", p. {html.escape(str(b['page']))}" if b.get("page") else ""
        items.append(f'<li id="ref-{n}">{doc.dress(html.escape(b["publisher"]), False)}, « {doc.dress(html.escape(b["title"]), False)} », '
                     f'{html.escape(b["date"])}{page}. <span class="url">{html.escape(b["url"])}</span> '
                     f'(consulté le {html.escape(b["accessed"])}).</li>')
    body = f'<h2>{BIB_HEADING}</h2><ol class="biblio">{"".join(items)}</ol>'
    return (BIB_HEADING, body, [], False, "bibliography", BIB_HEADING)


def arrange(sections, doc):
    """The order of the redesign: sections, annexes, bibliography, then the funding sentence once."""
    funding = [x for x in sections if x[0] == FUNDING_HEADING]
    rest = [x for x in sections if x[0] != FUNDING_HEADING]
    main, annex = [x for x in rest if x[4] != "annex"], [x for x in rest if x[4] == "annex"]
    bib = [bibliography_section(doc)] if doc.refs else []
    end = funding or [(FUNDING_HEADING, f"<h2>{FUNDING_HEADING}</h2><p>{FUNDING}</p>", [], False, "", FUNDING_HEADING)]
    return main + annex + bib + end


def contents(sections, doc):
    """The contents page after the cover: a line and a page number for each part, the figure list, one line on the badges."""
    items = ""
    for i, (title, body, _, _, _, label) in enumerate(sections):
        if not title:
            continue
        subs = "".join(f'<li><a href="#{a}">{doc.dress(re.sub(r"<[^>]*>", "", t), False)}</a></li>'
                       for a, t in re.findall(r'<h3 id="(h\d+)">(.*?)</h3>', body))
        items += f'<li><a href="#s{i}">{doc.dress(html.escape(label), False)}</a>{f"<ol>{subs}</ol>" if subs else ""}</li>'
    figures = "".join(f'<li><a href="#{a}"><span class="fl">{l.split()[0]} <span class="fnum">{l.split()[1]}</span></span>{doc.dress(html.escape(t), False)}</a></li>' for l, t, a in doc.listed)
    lof = f'<p class="toc-h">Liste des figures</p><ol class="lof">{figures}</ol>' if figures else ""
    line = ""
    if doc.badges_used:
        line = '<p class="badge-line">Badges de confiance : ' + " · ".join(f"{badge_html(k)} {k}" for k in BADGES) + "</p>"
    return f'<nav class="toc"><h2>{TOC_HEADING}</h2><ol class="parts">{items}</ol>{lof}{line}</nav>'


def open_points(doc):
    if not doc.draft or not doc.open:
        return ""
    items = "".join(f'<li><a href="#op-{n}" class="pg"></a><mark class="open">{t}</mark> <span class="where">{html.escape(s)}</span></li>'
                    for n, t, s in doc.open)
    return f'<section class="openpoints"><h2>Points ouverts</h2><ol>{items}</ol></section>'


def page(meta, doc, sections, mode, css):
    esc = lambda key: html.escape(french(meta.get(key, "")))
    byline = " · ".join(x for x in (esc("author"), "version " + esc("version") if meta.get("version") else "", esc("date")) if x)
    cover = (f'<header class="cover"><div class="head"><h1>{esc("title")}</h1><p class="sub">{esc("subtitle")}</p></div><div class="meta">'
             f'<p class="author">{esc("author")}</p></div></header>') if doc.redesign else (
        f'<header class="cover"><h1>{esc("title")}</h1><p class="sub">{esc("subtitle")}</p><p class="byline">{byline}</p></header>')
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc("title")}</title><style>{css}</style></head><body>
{cover}
{"" if doc.redesign else f'<div class="verso"><p class="funding-text">{FUNDING}</p></div>'}
{contents(sections, doc) if doc.redesign else ""}<main>{finish(sections, doc, mode)}</main>{open_points(doc)}
</body></html>"""


def load_bibliography(source, meta):
    """The bibliography file named in the front matter, checked entry by entry."""
    if "bibliography" not in meta:
        return {}
    path = Path(meta["bibliography"])
    if path.is_absolute() or ".." in path.parts:
        raise ReportError("the bibliography file must lie next to the input")
    try:
        bib = json.loads((source.parent / path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise ReportError(f"the bibliography file cannot be read: {e}") from e
    if not isinstance(bib, dict) or not all(isinstance(e, dict) for e in bib.values()):
        raise ReportError("the bibliography file must be an object of entries")
    for key, entry in bib.items():
        if not re.fullmatch(r"[\w.-]+", key):
            raise ReportError(f"bibliography key {key} may hold only letters, digits, _ . and -")
        missing = [f for f in BIB_FIELDS if not isinstance(entry.get(f), str) or not entry[f].strip()]
        if missing:
            raise ReportError(f"bibliography entry {key} lacks (as text): {', '.join(missing)}")
        entry["page"] = str(entry["page"]) if entry.get("page") not in (None, "") else ""
    return bib


FIGURE = re.compile(r'<figure class="fig.*?</figure>', re.S)
# share of a page left blank before a warning; share left blank above a figure before it waits; share of the page
# below which a section may not start; reflow passes; paragraphs a figure may wait
HOLE, FIG_HOLE, LOW_START, MAX_PASSES, MAX_DELAY = 0.33, 0.15, 2 / 3, 8, 4
HANG_MM = 20  # a floated figure may hang this far below the text beside it
MAX_NOTE_LAG = 1  # pages a note may stand after its call before the build warns
PARAGRAPH = re.compile(r"<(p|ol)>.*?</\1>", re.S)  # a list is text that a figure may pass; shortcut: a nested list is cut at its first end tag, upgrade if the report nests lists


def is_side(fragment):
    """A figure tag or class string that carries the `side` class."""
    return bool(re.match(r'(<figure class=")?fig side\b', fragment))


def delayed(page_html, delays):
    """The page with figure k moved after the next delays[k] paragraphs that follow it.

    A figure never moves past the last paragraph of its section, and never lands before another figure:
    text always follows it."""
    figs = list(FIGURE.finditer(page_html))
    for k in sorted(delays, reverse=True):
        m, after, taken = figs[k], figs[k].end(), []
        for _ in range(delays[k]):
            p = PARAGRAPH.match(page_html, after)
            if not p:
                break
            taken.append(p)
            after = p.end()
        while taken and not PARAGRAPH.match(page_html, after):
            after = taken.pop().start()
        moved = "".join(p.group(0) for p in taken)
        page_html = page_html[: m.start()] + moved + m.group(0) + page_html[after:]
    return page_html


def blocks_of_page(page_box):
    """The text blocks of one page in order, as (tag, class, top, bottom, section), and the foot of the free area.

    The box tree is WeasyPrint's private layout (`_page_box`): no public call gives the free space of a page. The
    tool pins the version in its Docker image; a renamed box makes `holes` find nothing and the tests fail."""
    found = []

    def walk(b, section):
        tag = getattr(b, "element_tag", None)
        if tag == "section":
            section = b.element.get("id")
        if tag in ("p", "figure", "h2", "h3", "table", "aside", "div", "nav", "ol"):
            found.append((tag, b.element.get("class") or "", b.position_y, b.position_y + b.margin_height(), section))
            return
        for c in getattr(b, "children", []) or []:
            walk(c, section)

    foot = page_box.content_box_y() + page_box.height
    for c in page_box.children:
        if type(c).__name__ == "FootnoteAreaBox":
            foot = c.position_y
        elif type(c).__name__ == "BlockBox":
            walk(c, None)
    return found, foot, page_box.height


def holes(pdf):
    """Figures that open a page while the page before leaves a blank of more than FIG_HOLE of a page: their ordinals."""
    ordinal, found, prev = 0, [], None
    for page in pdf.pages:
        blocks, foot, height = blocks_of_page(page._page_box)
        if prev and blocks and blocks[0][0] == "figure":
            before, before_foot = prev
            same_section = before and blocks[0][4] == before[-1][4]
            if same_section and before_foot - max(b[3] for b in before) > FIG_HOLE * height:
                found.append(ordinal)
        ordinal += sum(1 for b in blocks if b[0] == "figure")
        prev = (blocks, foot)
    return found


def pushed_floats(pdf):
    """Ordinals of the floated figures that open a page and hang there with too little text beside them (more than
    HANG_MM of the float stands without text): they go back into the flow. A float that moves to the next page with
    enough text to run beside it stays."""
    ordinal, found = 0, []
    for page in pdf.pages:
        blocks = blocks_of_page(page._page_box)[0]
        text_end = max((b[3] for b in blocks[1:] if b[0] in ("p", "ol")), default=0)
        if blocks and blocks[0][0] == "figure" and is_side(blocks[0][1]) and text_end < blocks[0][3] - HANG_MM * 96 / 25.4:  # shortcut: a float after a heading is missed
            found.append(ordinal)
        ordinal += sum(1 for b in blocks if b[0] == "figure")
    return found


def unfloated(page_html, plain):
    """The page with the floated figures of the given ordinals set back in the flow, at full width."""
    seen = []

    def fix(m):
        seen.append(1)
        return m.group(0).replace(' side"', '"', 1) if len(seen) - 1 in plain else m.group(0)
    return FIGURE.sub(fix, page_html)


def low_starts(pdf):
    """Ids of the sections whose heading sits in the last third of a page."""
    found = []
    for page in pdf.pages:
        blocks, foot, height = blocks_of_page(page._page_box)
        top = page._page_box.content_box_y()
        found += [b[4] for b in blocks if b[0] == "h2" and b[4] and (b[2] - top) / height > LOW_START]
    return found


def note_lag(pdf):
    """For each note in order, the pages between its call and its text at the page foot (0: the same page).

    The k-th call and the k-th note area entry belong together: first citations are numbered in order of print.
    Private box names of WeasyPrint, as in `blocks_of_page`."""
    calls, feet = [], []

    def walk(b, n, in_area=False):
        tag = getattr(b, "element_tag", None)
        if type(b).__name__ == "TextBox" and tag == "span::footnote-call":
            calls.append(n)
        elif type(b).__name__ == "BlockBox" and in_area and tag == "span":
            feet.append(n)
        for c in getattr(b, "children", []) or []:
            walk(c, n, in_area or type(b).__name__ == "FootnoteAreaBox")

    for n, page in enumerate(pdf.pages, 1):
        walk(page._page_box, n)
    return [f - c for c, f in zip(calls, feet)]


def reflow(page_html, base_url):
    """Render the PDF. A figure that opens a page after a blank of more than FIG_HOLE waits one paragraph more; a
    section whose heading falls in the last third of a page starts a new page; repeat until nothing moves."""
    from weasyprint import HTML
    delays, fresh, plain, pdf = {}, set(), set(), None
    for _ in range(MAX_PASSES):
        text = unfloated(delayed(page_html, delays), plain)
        for sid in fresh:
            text = text.replace(f'<section id="{sid}" class="', f'<section id="{sid}" class="newpage ', 1)
        pdf = HTML(string=text, base_url=base_url).render()
        low = set(low_starts(pdf)) - fresh
        pushed = set(pushed_floats(pdf)) - plain
        # a figure with no paragraph after it cannot move: it must not cost another pass
        moves = [k for k in holes(pdf) if delays.get(k, 0) < MAX_DELAY and k < len(FIGURE.findall(page_html))
                 and delayed(page_html, {**delays, k: delays.get(k, 0) + 1}) != delayed(page_html, delays)]
        if not moves and not low and not pushed:
            break
        fresh |= low
        plain |= pushed
        for k in moves:
            delays[k] = delays.get(k, 0) + 1
    else:
        print(f"warning: the layout did not settle in {MAX_PASSES} passes: a blank or a late heading may remain", file=sys.stderr)
    lag = note_lag(pdf)
    if lag and max(lag) > MAX_NOTE_LAG:
        print(f"warning: note {lag.index(max(lag)) + 1} is {max(lag)} pages after its call ({sum(1 for x in lag if x > MAX_NOTE_LAG)} notes more than {MAX_NOTE_LAG} page late)", file=sys.stderr)
    for n, page in enumerate(pdf.pages, 1):
        blocks, foot, height = blocks_of_page(page._page_box)
        blank = (foot - max((b[3] for b in blocks), default=foot)) / height
        if n > 1 and blank > HOLE:
            print(f"warning: page {n} is {blank:.0%} blank; its last block is {blocks[-1][0]} {blocks[-1][1]}".strip(), file=sys.stderr)
    return pdf


def build(source, figures, out, draft=False, name=None, theme_css=None):
    """Write OUT/NAME.html and OUT/NAME.pdf; return the PDF page count. A theme file is CSS read after the report CSS."""
    from weasyprint import HTML
    source, out = Path(source), Path(out)
    text = source.read_text(encoding="utf-8")
    meta, text = front_matter(text)
    notes = {m["label"]: " ".join(m["body"].split()) for m in re.finditer(
        r"^\[\^(?P<label>[^\]]+)\]:[ \t]*(?P<body>.*(?:\n[ \t]+.*)*)", text, re.M)}
    text = re.sub(r"^\[\^[^\]]+\]:.*(?:\n[ \t]+.*)*\n?", "", text, flags=re.M)
    head, blocks = head_meta([b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()])
    meta = {**head, **meta}
    if "title" not in meta:
        raise ReportError("the input has no title")
    redesign = meta.get("layout") == "redesign"
    doc = Doc(notes, draft, figures, redesign, load_bibliography(source, meta) if redesign else None)
    sections = doc.sections(blocks)
    if redesign:
        for key in sorted(set(doc.bib) - set(doc.refs)):
            print(f"warning: bibliography entry never cited: {key}", file=sys.stderr)
        sections = arrange(sections, doc)
    unused = set(notes) - set(doc.order)
    if unused:
        print(f"warning: footnotes defined and never cited: {', '.join(sorted(unused))}", file=sys.stderr)
    raw = re.findall(r"(?<!\^)\[[A-ZÀ-Ý][A-ZÀ-Ý ]{3,}\b[^\]]*\]", source.read_text(encoding="utf-8"))
    if (doc.open or raw) and not draft:
        raise ReportError(f"open marker(s) in a final build; first: {(doc.open and doc.open[0][1]) or raw[0]}")
    tokens = site_tokens()
    css = ":root{" + ";".join(f"--{k}:{v}" for k, v in tokens.items()) + "}\n" + (HERE / "report.css").read_text(encoding="utf-8") + (Path(theme_css).read_text(encoding="utf-8") if theme_css else "")
    out.mkdir(parents=True, exist_ok=True)
    name = name or source.stem
    page_html = page(meta, doc, sections, "html", css)
    if redesign and (leak := DOC_ID.search(page_html)):
        raise ReportError(f"a document identifier would print: {leak[0]}")
    (out / f"{name}.html").write_text(page_html, encoding="utf-8")
    pdf = reflow(page(meta, doc, sections, "pdf", css), str(out)) if redesign else HTML(string=page(meta, doc, sections, "pdf", css), base_url=str(out)).render()
    pdf.write_pdf(out / f"{name}.pdf")
    print(f"{name}: {len(pdf.pages)} pages, {len(doc.order)} notes, {len(doc.open)} open markers")
    return len(pdf.pages)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("input")
    p.add_argument("--figures", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--draft", action="store_true")
    p.add_argument("--name")
    p.add_argument("--theme-css", help="a CSS file read after the report CSS: it may reset the tokens of :root")
    a = p.parse_args(argv)
    try:
        build(a.input, a.figures, a.out, a.draft, a.name, a.theme_css)
    except (ReportError, FileNotFoundError) as e:
        sys.exit(f"error: {e}")
    except (ImportError, OSError) as e:
        sys.exit(f"error: WeasyPrint is not usable ({e.__class__.__name__}); see the install line in the header of this file")


if __name__ == "__main__":
    main()
