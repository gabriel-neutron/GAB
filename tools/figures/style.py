"""The shared style of the report figures (Dossier style).

Every colour, font and size of a figure comes from this file. A figure script sets none.
The colours are the light-theme tokens of the site stylesheet, read by `tokens.py`.
Fonts: the files in `fonts/` are registered.
"""
import csv
import html
import sys
import textwrap
import warnings
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import tokens as tk  # noqa: E402
from tokens import oklch  # noqa: E402,F401  (kept here: figure scripts and tests import it from style)

WIDTH_MM = 166
MM = 1 / 25.4
THIN = " "
# Dossier style: thin lines, hollow marks, serif text in the body face. Sizes in points at print (7 pt is the floor).
TITLE_PT, TEXT_PT, NOTE_PT = 9, 8, 7.5
LINE_W, MARKER, ARROW = 0.8, 4, 8
SEMIBOLD = "semibold"  # weight 600 of Source Serif 4; JetBrains Mono has no semibold file, so it uses bold
HALO = "#000000"
# Two grey marks must differ by this much in OKLab lightness to stay apart in grey print.
MIN_GREY_STEP = 0.12
CHROMA_LIMIT = 0.03


class StyleError(ValueError):
    """A figure breaks a rule of the style."""


def _oklab(hexcolor):
    r, g, b = (int(hexcolor[i:i + 2], 16) / 255 for i in (1, 3, 5))
    r, g, b = (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def lightness(hexcolor):
    return _oklab(hexcolor)[0]


def chroma(hexcolor):
    return math.hypot(*_oklab(hexcolor)[1:])


# Role of each site token in a figure: ink for text, three text steps, a strong thin rule for axes and context marks, a light rule for the grid.
INK = tk.hex("foreground")
SECOND = tk.hex("muted-foreground")
LABEL = tk.hex("label")
CONTEXT = tk.hex("input")
AXIS = tk.hex("input")
GRID = tk.hex("border")
BAND = tk.hex("muted")
INPUT = tk.hex("input")
ACCENT = tk.hex("primary")
PAPER = tk.hex("card")  # the ground of a figure; also the colour of a hollow mark and of the gap between parts
WHITE = "#ffffff"
# Parts of a stacked bar, light to dark: four greys of the site. Eight parts at most: parts five to eight reuse a grey with a hatch.
GREY_STEPS = [tk.hex(t) for t in ("border", "input", "muted-foreground", "foreground")]
PART_FILLS = [(g, "") for g in GREY_STEPS] + [(GREY_STEPS[i], "///") for i in (0, 1, 2, 3)]


@dataclass(frozen=True)
class Mark:
    """What marks a series or a category: a colour and at least one second mark."""
    name: str
    color: str
    marker: str = ""
    linestyle: str = "-"
    hatch: str = ""
    label: str = ""


# Series of a line chart: three greys and three marker shapes, all hollow. Dashed is kept for mirror data.
SERIES = [Mark("ink", INK, "o"), Mark("second", SECOND, "s"), Mark("context", CONTEXT, "^")]
# EU is the solid fill; its second mark is the fill itself next to the hatched others.
REGIMES = {
    "EU": Mark("EU", ACCENT, label="EU"),
    "UK": Mark("UK", tk.hex("entity-5"), hatch="///", label="UK"),
    "US": Mark("US", tk.hex("entity-2"), hatch="\\\\\\", label="US"),
    "multi": Mark("multi", SECOND, hatch="xxx", label="Two or more"),
}

# Words of the output by locale. The default is English.
WORDS = {
    "en": {"Figure": "Figure", "Table": "Table", "source": "Source:", "note": "Note:",
           "multi": "Two or more", "US": "US", "view": "View in the dataset", "high": "high bound", "min": "min", "max": "max", "median": "median",
           "zero": "does not start at zero", "ratio": "ratio scale", "dec": ".", "thou": ",",
           "active": "Active", "stopped": "Stopped", "exempted": "Exempted", "approx": "Approximate location",
           "basemap": "Base map: Natural Earth", "full": "Condition met", "half": "Condition partly met",
           "empty": "Condition not met", "undocumented": "Not documented"},
    "fr": {"Figure": "Figure", "Table": "Tableau", "source": "Source :", "note": "Note :",
           "multi": "Deux séries ou plus", "US": "États-Unis", "view": "Voir dans le jeu de données",
           "high": "borne haute", "min": "min", "max": "max", "median": "médiane", "zero": "ne commence pas à zéro", "ratio": "échelle de rapport",
           "dec": ",", "thou": " ",
           "active": "Actif", "stopped": "Arrêté", "exempted": "Exempté", "approx": "Localisation approximative",
           "basemap": "Fond de carte : Natural Earth", "full": "Condition remplie",
           "half": "Condition remplie en partie", "empty": "Condition non remplie",
           "undocumented": "Non documenté"},
}
DOC_ID = re.compile(r"doc_[0-9a-f]{12}")
# The run option set by `configure`.
OPTIONS = {"locale": "en"}


def configure(locale="en"):
    if locale not in WORDS:
        raise StyleError(f"unknown locale: {locale}")
    OPTIONS["locale"] = locale


def word(key):
    return WORDS[OPTIONS["locale"]][key]


def regime_label(key):
    return word(key) if key in ("multi", "US") else REGIMES[key].label


def check_marks(marks):
    """Fail when two greys are too close, or when a hue has no second mark."""
    marks = list(marks)
    for m in marks:
        if chroma(m.color) > CHROMA_LIMIT and not (m.marker or m.hatch or m.label):
            raise StyleError(f"hue of '{m.name}' has no second mark")
    for i, a in enumerate(marks):
        for b in marks[i + 1:]:
            if abs(lightness(a.color) - lightness(b.color)) >= MIN_GREY_STEP:
                continue
            # Two greys must differ in grey. A hue may share a grey if its second mark differs.
            both_grey = chroma(a.color) <= CHROMA_LIMIT and chroma(b.color) <= CHROMA_LIMIT
            if both_grey or (a.marker, a.hatch, a.linestyle) == (b.marker, b.hatch, b.linestyle):
                raise StyleError(f"'{a.name}' and '{b.name}' share a grey level")
    return marks


def register_fonts():
    for f in (HERE / "fonts").glob("*.[to]tf"):
        font_manager.fontManager.addfont(str(f))
    plt.rcParams.update({
        "font.family": tk.FONTS["serif"][0],
        "font.size": TEXT_PT, "svg.fonttype": "none", "axes.edgecolor": AXIS,
        "text.color": INK, "axes.labelcolor": LABEL, "xtick.color": LABEL, "ytick.color": LABEL,
        "axes.facecolor": "none", "figure.facecolor": "none", "savefig.facecolor": "none",
        "axes.linewidth": LINE_W * 0.6, "grid.color": GRID, "grid.linewidth": 0.5,
        "legend.frameon": False, "hatch.linewidth": 0.6, "hatch.color": INK,
    })


register_fonts()
# The mono face of the site, then the CSS stack of the HTML figures.
MONO = tk.FONTS["mono"]
MONO_FACE = MONO[0]


# Size classes for the page of 166 mm text width and 250 mm text height. A figure and its caption stay on one page:
# the heights leave room for a caption of 20 mm. Class "pair" is 81 mm wide: two stand side by side at 1:1.
SIZES = {"third": 70, "half": 110, "full": 210, "pair": 80}
PAIR_WIDTH_MM = 81
_width = {"mm": WIDTH_MM}
TITLE_WORDS = 8


def scale():
    """How many times narrower than the text block the figure is (1 for the full width, about 2 for a pair)."""
    return WIDTH_MM / _width["mm"]


def fit_label(text):
    """A category label of a narrow figure wraps at 16 characters."""
    return textwrap.fill(text, 16, break_long_words=False) if scale() > 1.5 else text


def legend_cols(labels, default=None):
    """Legend columns. A full-width figure keeps `default` (one column for each label if none).
    A narrow figure uses as many columns as fit in 40 mm (1.75 mm a character, 10 mm for a key)."""
    n = len(labels)
    if scale() <= 1.5:
        return default or n
    for c in range(n, 1, -1):
        per = -(-n // c)
        cols = [labels[i:i + per] for i in range(0, n, per)]
        if sum(max(len(s) for s in col) * 1.75 + 10 for col in cols) <= 40:
            return len(cols)
    return 1


def size_height(meta, default_mm):
    """The height of a figure: `height_mm` of the caption file, else the size class, else the content height.

    A class smaller than the content is refused; `height_mm` is the explicit way to squeeze a figure."""
    _width["mm"] = PAIR_WIDTH_MM if meta.get("size") == "pair" else WIDTH_MM
    if "height_mm" in meta:
        return meta["height_mm"]
    if "size" not in meta:
        return default_mm
    if meta["size"] not in SIZES:
        raise StyleError(f"unknown size class: {meta['size']}")
    if SIZES[meta["size"]] < default_mm:
        raise StyleError(f"size class {meta['size']} is too small for the content: {default_mm:.0f} mm needed; set height_mm to squeeze it")
    return SIZES[meta["size"]]


def need_sources(items, what):
    """A mark with no source key does not go in: no arrow, line or event without a source."""
    for it in items:
        if not str(it.get("source", "")).strip():
            raise StyleError(f"{what} has no source: {it.get('id') or it.get('label') or it.get('date')}")


def renderer(fig):
    """The renderer of a drawn figure; matplotlib 3.11 moved it from the canvas to the figure."""
    return fig.canvas.get_renderer() if hasattr(fig.canvas, "get_renderer") else fig._get_renderer()


def new_fig(height_mm):
    return plt.figure(figsize=(_width["mm"] * MM, height_mm * MM), layout="constrained")


def style_axes(ax, unit="", value_axis="y"):
    """No value-axis line, hairline grid, hairline category axis, unit horizontal above the axis."""
    cat, val = ("x", "y") if value_axis == "y" else ("y", "x")
    for s in ("top", "right", "left", "bottom"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom" if cat == "x" else "left"].set_visible(True)
    ax.grid(True, axis=val)
    ax.set_axisbelow(True)
    ax.tick_params(axis=val, length=0)
    (ax.yaxis if val == "y" else ax.xaxis).set_major_formatter(FuncFormatter(lambda v, _: num(v, 6)))
    ax.tick_params(axis=cat, length=2, width=0.5)
    ax.spines["bottom" if cat == "x" else "left"].set_linewidth(LINE_W)
    if unit and scale() > 1.5 and value_axis == "x":
        # narrow: the legend takes the width above the bars, so the unit goes under the axis
        ax.set_xlabel(textwrap.fill(unit, 38, break_long_words=False), loc="left", color=LABEL, fontsize=TEXT_PT, fontstyle="italic")
    elif unit and scale() > 1.5:
        ax.text(0, 1.03, textwrap.fill(unit, 38, break_long_words=False), transform=ax.transAxes, ha="left", va="bottom", color=LABEL, fontsize=TEXT_PT, fontstyle="italic")
    elif unit:
        # horizontal bars carry their legend at the left, so the unit goes to the right end
        right = value_axis == "x"
        ax.text(1 if right else 0, 1.03, unit, transform=ax.transAxes, ha="right" if right else "left",
                va="bottom", color=LABEL, fontsize=TEXT_PT, fontstyle="italic")


def panel_title(ax, text, letter=None):
    """The title of a panel. With a letter, a small accent square holds it, left of the title."""
    if scale() > 1.5:
        text = textwrap.fill(text, 34, break_long_words=False)
    if not letter:
        ax.set_title(text, loc="left", fontsize=TITLE_PT, fontweight=SEMIBOLD, color=INK)
        return
    ax.annotate(letter, (0, 1), xycoords="axes fraction", xytext=(0, 5), textcoords="offset points", ha="left", va="bottom",
                fontsize=NOTE_PT, fontweight="bold", color=ACCENT, annotation_clip=False,
                bbox=dict(boxstyle="square,pad=0.25", facecolor="none", edgecolor=ACCENT, linewidth=0.8))
    ax.annotate(text, (0, 1), xycoords="axes fraction", xytext=(16, 4), textcoords="offset points", ha="left", va="bottom",
                fontsize=TITLE_PT, fontweight=SEMIBOLD, color=INK, annotation_clip=False)


def panel_letter(k):
    if k > 25:
        raise StyleError("a figure holds 26 panels at most")
    return chr(65 + k)


def note_mark(ax, x, y, n, dx=10, dy=8):
    """A numbered annotation: an accent disc with the number, beside the point (x, y). The note goes under the figure."""
    ax.annotate(str(n), (x, y), xytext=(dx, dy), textcoords="offset points", ha="center", va="center", fontsize=NOTE_PT,
                fontweight="bold", color=PAPER, annotation_clip=False,
                bbox=dict(boxstyle="circle,pad=0.25", facecolor=ACCENT, edgecolor="none"))


def notes_below(fig, meta):
    """Write the notes of the numbered annotations under the figure (meta key `annotations`: [{n, text}])."""
    items = meta.get("annotations") or []
    if items:
        fig.supxlabel(chr(10).join(f"{a['n']}  {a['text']}" for a in items), x=0, ha="left", fontsize=NOTE_PT, fontstyle="italic",
                      color=LABEL)


def num(v, places=1):
    s = f"{v:,.{places}f}"
    s = s.rstrip("0").rstrip(".") if "." in s else s
    return s.replace(",", "#").replace(".", word("dec")).replace("#", word("thou"))


def num_label(v, floor=0.1):
    """A value label; a positive value under the floor prints as '<floor'."""
    return f"<{num(floor, 6)}" if 0 < v < floor else num(v)


def label_room(chars, per_char=0.015):
    """Share of the axis width to keep free after a label of this many characters."""
    return min(0.5, per_char * scale() * chars + 0.02)


def pct(v, places=1):
    return num(v, places) + THIN + "%"


def read_data(path):
    """Read one data file of the report: columns as in packages/site/report/*.csv.

    The document is `doc_` plus 12 hex characters; any other value is refused.
    """
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise StyleError("the data file is empty")
    for i, r in enumerate(rows, 2):
        if not DOC_ID.fullmatch(str(r.get("document", ""))):
            raise StyleError(f"line {i}: the value has no doc_ identifier (doc_ and 12 hex characters)")
        try:
            r["valeur"] = float(r["valeur"])
        except (KeyError, ValueError) as e:
            raise StyleError(f"line {i}: the value is not a number") from e
    seen = set()
    for r in rows:
        key = (r["serie"], r["periode"], r.get("panel", ""))
        if key in seen:
            raise StyleError(f"duplicate row: {key}")
        seen.add(key)
    return rows


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def order(rows, key):
    return list(dict.fromkeys(r[key] for r in rows))


CAPTION_FIELDS = ("number", "title", "source", "note")


def caption_html(meta, kind="Figure"):
    """number, title, source, note; then the mono line with the short address."""
    miss = [k for k in CAPTION_FIELDS if not str(meta.get(k, "")).strip()]
    if miss:
        raise StyleError(f"the caption lacks: {', '.join(miss)}")
    if len(str(meta["title"]).split()) > TITLE_WORDS:
        warnings.warn(f"the title has more than {TITLE_WORDS} words: {meta['title']}", stacklevel=2)
    e = html.escape
    unit = f" ({e(meta['unit'])})" if meta.get("unit") else ""
    source = meta["source"]
    out = (f'<p class="caption"><strong>{word(kind)} {e(str(meta["number"]))}. {e(meta["title"])}{unit}.'
           f'</strong> {word("source")} {e(source)} {word("note")} {e(meta["note"])}</p>\n')
    if meta.get("address"):
        out += f'<p class="address"><code>{word("view")} → {e(meta["address"])}</code></p>\n'
    return out


def save(fig, out_dir, stem, meta, grey=False):
    """Write the SVG (text kept as text), the PNG and the caption of one figure."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    notes_below(fig, meta)
    # the rule above a figure: the ink rule of the Dossier style
    fig.add_artist(Line2D([0, 1], [1, 1], transform=fig.transFigure, color=INK, linewidth=1.2, solid_capstyle="butt", clip_on=False))
    fig.savefig(out / f"{stem}.svg", transparent=True)
    fig.savefig(out / f"{stem}.png", dpi=200, transparent=False, facecolor=PAPER)
    (out / f"{stem}.caption.html").write_text(caption_html(meta), encoding="utf-8")
    if grey:
        from PIL import Image
        Image.open(out / f"{stem}.png").convert("L").save(out / f"{stem}.grey.png")
    plt.close(fig)
    return [out / f"{stem}.{x}" for x in ("svg", "png", "caption.html")]


def require_axis_note(meta, zero, ratio):
    """The caption says when a value axis does not start at zero, or is a ratio scale."""
    note = meta.get("note", "").lower()
    if ratio and word("ratio") not in note:
        raise StyleError(f'the note must say "{word("ratio")}"')
    if not ratio and not zero and word("zero") not in note:
        raise StyleError(f'the note must say "{word("zero")}"')


def spread(ys, gap):
    """Move label positions apart by at least `gap`, keeping their order; clusters stay centred."""
    clusters = []
    for i in sorted(range(len(ys)), key=ys.__getitem__):
        clusters.append([i])
        while len(clusters) > 1 and _start(clusters[-2], ys, gap) + len(clusters[-2]) * gap > _start(clusters[-1], ys, gap):
            last = clusters.pop()
            clusters[-1] += last
    out = list(ys)
    for c in clusters:
        for k, i in enumerate(c):
            out[i] = _start(c, ys, gap) + k * gap
    return out


def _start(cluster, ys, gap):
    return sum(ys[i] - k * gap for k, i in enumerate(cluster)) / len(cluster)


def end_labels(fig, groups):
    """Write the end labels; `groups` is [(ax, [(x, y, text, color)])]. Close labels move apart
    and a leader line joins each moved label to its point. Call after the layout is set."""
    fig.canvas.draw()
    gap = TEXT_PT * 1.25 * max((t.count(chr(10)) + 1 for _, items in groups for _, _, t, _ in items), default=1) * fig.dpi / 72
    for ax, items in groups:
        ys = [ax.transData.transform((x, y))[1] for x, y, _, _ in items]
        for (x, y, text, color), y0, y1 in zip(items, ys, spread(ys, gap)):
            dy = (y1 - y0) * 72 / fig.dpi
            # a light mark colour would print the text below 4.5:1: the text takes the second ink
            ax.annotate(text, (x, y), xytext=(8, dy), textcoords="offset points", va="center", color=color if lightness(color) < 0.55 else SECOND,
                        fontsize=TEXT_PT, annotation_clip=False,
                        arrowprops=dict(arrowstyle="-", color=color, lw=0.5, shrinkA=0, shrinkB=2)
                        if abs(dy) > 0.5 else None)
