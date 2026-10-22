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

Redesign layout. The front matter keys `layout: redesign` and `bibliography: FILE` (a JSON file next to
the input) switch on: numbered references, a table of contents after the cover, the badge legend, an
annex section type, side-by-side panels and the funding sentence once at the end.
- A reference is `[@key]` or `[@key1; @key2]`. It prints as `[n]`, numbered by first use, linked to the
  entry of the bibliography; in a table it prints as a superscript number. The bibliography file is a JSON
  object: key -> {publisher, title, date, url, accessed, page?}. An unknown key, a missing field or a
  `doc_` identifier in the output stops the build.
- A claim badge is `{{Établi}}`, `{{Probable}}`, `{{Indicatif}}` or `{{Non établi}}`, after a material
  claim. It is a symbol plus a letter, so it reads in grey print. Its legend prints once, after the contents.
- A section titled "Chiffres clés" is a page of its own. A section titled "Annexe A. …" is an annex.
- Two images before one caption stand side by side.

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
NBSP, THIN = " ", " "


class ReportError(ValueError):
    """The input breaks a rule of the report."""


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


class Doc:
    def __init__(self, notes, draft, figures, redesign=False, bibliography=None):
        self.notes, self.draft, self.figures = notes, draft, Path(figures)
        self.redesign, self.bib = redesign, bibliography or {}
        self.refs, self.badges_used, self.in_table = {}, False, False
        self.order, self.note_html, self.uses = {}, {}, {}
        self.section_notes, self.open, self.section = [], [], ""

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
        alt, path = re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", block).groups()
        stem = Path(path).stem
        for ext, mime in ((".svg", "image/svg+xml"), (".png", "image/png")):
            if (self.figures / (stem + ext)).exists():
                data = base64.b64encode((self.figures / (stem + ext)).read_bytes()).decode()
                return f'<img alt="{html.escape(alt)}" src="data:{mime};base64,{data}">'
        raise ReportError(f"figure file not found: {stem}.svg or {stem}.png in {self.figures}")

    def caption(self, block):
        raw = block.replace("**", "")
        label, rest = re.match(r"((?:Figure|Tableau)\s+\S+?\.)\s*(.*)$", raw, re.S).groups()
        title, tail = (re.split(r"\s(?=Sources?\s?:)", rest, maxsplit=1) + [""])[:2]
        return self.text(f"**{label} {title}** {tail}").replace("<p>", '<p class="caption">', 1)

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
                    side = " panels" if self.redesign and len(plates) > 1 else ""
                    out.append(f'<figure class="fig{side}"><div class="plates">{"".join(plates)}</div>{self.caption(b)}</figure>')
                    plates = []
                elif i < len(blocks) and blocks[i].startswith("|"):
                    out.append(f'<div class="tablebox">{self.caption(b)}{self.table(blocks[i])}</div>')
                    i += 1
                else:
                    out.append(self.caption(b))
            else:
                if plates:
                    raise ReportError("a figure has no caption")
                out.append(self.block(b))
        if plates:
            raise ReportError("a figure has no caption")
        return "".join(out)

    def block(self, b):
        if m := re.match(r"(#{3,6})\s+(?:(\d+(?:\.\d+)*\.?)\s+)?(.*)", b):
            level, num, title = len(m[1]), m[2], m[3]
            self.refuse_marks(title)
            return f'<h{level}>{f"<span class=num>{num}</span> " if num else ""}{self.dress(self.inline(title), False)}</h{level}>'
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
        cls = " ".join(c for c, on in (("reserved", reserved), ("funding", title == FUNDING_HEADING), (kind, kind)) if on)
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
    """The order of the redesign: sections, bibliography, annexes, then the funding sentence once."""
    funding = [x for x in sections if x[0] == FUNDING_HEADING]
    rest = [x for x in sections if x[0] != FUNDING_HEADING]
    main, annex = [x for x in rest if x[4] != "annex"], [x for x in rest if x[4] == "annex"]
    bib = [bibliography_section(doc)] if doc.refs else []
    end = funding or [(FUNDING_HEADING, f"<h2>{FUNDING_HEADING}</h2><p>{FUNDING}</p>", [], False, "", FUNDING_HEADING)]
    return main + bib + annex + end


def contents(sections, doc):
    """The table of contents and the badge legend: one page after the cover."""
    items = "".join(f'<li><a href="#s{i}">{doc.dress(html.escape(label), False)}</a></li>'
                    for i, (title, _, _, _, _, label) in enumerate(sections) if title)
    legend = ""
    if doc.badges_used:
        rows = "".join(f"<li>{badge_html(level)} <strong>{level}</strong> : {text}</li>"
                       for level, (_, _, text) in BADGES.items())
        legend = f'<aside class="badge-legend"><p class="lt">Lecture du badge</p><ul>{rows}</ul></aside>'
    return f'<nav class="toc"><h2>{TOC_HEADING}</h2><ol>{items}</ol>{legend}</nav>'


def open_points(doc):
    if not doc.draft or not doc.open:
        return ""
    items = "".join(f'<li><a href="#op-{n}" class="pg"></a><mark class="open">{t}</mark> <span class="where">{html.escape(s)}</span></li>'
                    for n, t, s in doc.open)
    return f'<section class="openpoints"><h2>Points ouverts</h2><ol>{items}</ol></section>'


def page(meta, doc, sections, mode, css):
    esc = lambda key: html.escape(french(meta.get(key, "")))
    byline = " · ".join(x for x in (esc("author"), "version " + esc("version") if meta.get("version") else "", esc("date")) if x)
    flag = '<p class="draft-flag">Brouillon</p>' if doc.draft else ""
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc("title")}</title><style>{css}</style></head><body>
<header class="cover"><h1>{esc("title")}</h1><p class="sub">{esc("subtitle")}</p>{flag}<p class="byline">{byline}</p></header>
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


def build(source, figures, out, draft=False, name=None):
    """Write OUT/NAME.html and OUT/NAME.pdf; return the PDF page count."""
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
    css = ":root{" + ";".join(f"--{k}:{v}" for k, v in tokens.items()) + "}\n" + (HERE / "report.css").read_text(encoding="utf-8")
    out.mkdir(parents=True, exist_ok=True)
    name = name or source.stem
    page_html = page(meta, doc, sections, "html", css)
    if redesign and (leak := DOC_ID.search(page_html)):
        raise ReportError(f"a document identifier would print: {leak[0]}")
    (out / f"{name}.html").write_text(page_html, encoding="utf-8")
    pdf = HTML(string=page(meta, doc, sections, "pdf", css), base_url=str(out)).render()
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
    a = p.parse_args(argv)
    try:
        build(a.input, a.figures, a.out, a.draft, a.name)
    except (ReportError, FileNotFoundError) as e:
        sys.exit(f"error: {e}")
    except (ImportError, OSError) as e:
        sys.exit(f"error: WeasyPrint is not usable ({e.__class__.__name__}); see the install line in the header of this file")


if __name__ == "__main__":
    main()
