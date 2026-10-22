"""The shared style of the report figures.

Every colour, font and size of a figure comes from this file. A figure script sets none.
The tokens are the light-theme oklch values of the site stylesheet.
Fonts: the files in `fonts/` are registered when they exist. Else the face falls back to
the DejaVu face that ships with matplotlib.
"""
import csv
import html
import sys
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
from matplotlib.ticker import FuncFormatter  # noqa: E402

HERE = Path(__file__).parent
WIDTH_MM = 160
MM = 1 / 25.4
THIN = " "
TITLE_PT, TEXT_PT, NOTE_PT = 9, 8, 7.5
LINE_W, MARKER, ARROW = 1.2, 4, 8
HALO = "#000000"
# Two grey marks must differ by this much in OKLab lightness to stay apart in grey print.
MIN_GREY_STEP = 0.12
CHROMA_LIMIT = 0.03


class StyleError(ValueError):
    """A figure breaks a rule of the style."""


def _oklab_to_hex(L, a, b):
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
           -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
           -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_)
    gam = [12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055 for c in lin]
    return "#" + "".join(f"{round(min(1, max(0, c)) * 255):02x}" for c in gam)


def oklch(token):
    """Convert 'oklch(L C H)' to a hex colour."""
    L, C, H = (float(x) for x in re.findall(r"[\d.]+", token)[:3])
    return _oklab_to_hex(L, C * math.cos(math.radians(H)), C * math.sin(math.radians(H)))


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


# Light theme of the site; "context" and "grid" are the two greys the ticket places between tokens.
INK = oklch("oklch(0.2 0.01 230)")
SECOND = oklch("oklch(0.4 0.01 230)")
LABEL = oklch("oklch(0.5 0.01 230)")
CONTEXT = oklch("oklch(0.68 0.008 230)")
AXIS = oklch("oklch(0.86 0.006 230)")
GRID = oklch("oklch(0.91 0.005 230)")
BAND = oklch("oklch(0.945 0.004 230)")
INPUT = oklch("oklch(0.62 0.008 230)")
WHITE = "#ffffff"
# Parts of a stacked bar, light to dark.
GREY_STEPS = [oklch(f"oklch({v} 0.006 230)") for v in (0.88, 0.74, 0.6, 0.45, 0.3)]
# Eight parts at most: parts six to eight reuse a grey with a hatch as the second mark.
PART_FILLS = [(g, "") for g in GREY_STEPS] + [(GREY_STEPS[i], "///") for i in (3, 1, 4)]


@dataclass(frozen=True)
class Mark:
    """What marks a series or a category: a colour and at least one second mark."""
    name: str
    color: str
    marker: str = ""
    linestyle: str = "-"
    hatch: str = ""
    label: str = ""


# Series of a line chart: three greys and three marker shapes. Dashed is kept for mirror data.
SERIES = [Mark("ink", INK, "o"), Mark("second", SECOND, "s"), Mark("context", CONTEXT, "^")]
# EU is the solid fill; its second mark is the fill itself next to the hatched others.
REGIMES = {
    "EU": Mark("EU", oklch("oklch(0.42 0.11 255)"), label="EU"),
    "UK": Mark("UK", oklch("oklch(0.62 0.12 70)"), hatch="///", label="UK"),
    "US": Mark("US", oklch("oklch(0.80 0.06 200)"), hatch="\\\\\\", label="US"),
    "multi": Mark("multi", SECOND, hatch="xxx", label="Two or more"),
}

# Words of the output by locale. The default is English.
WORDS = {
    "en": {"Figure": "Figure", "Table": "Table", "source": "Source:", "note": "Note:",
           "multi": "Two or more", "US": "US", "view": "View in the dataset", "high": "high bound", "min": "min", "max": "max", "median": "median",
           "zero": "does not start at zero", "ratio": "ratio scale", "dec": ".", "thou": ","},
    "fr": {"Figure": "Figure", "Table": "Tableau", "source": "Source :", "note": "Note :",
           "multi": "Deux séries ou plus", "US": "États-Unis", "view": "Voir dans le jeu de données",
           "high": "borne haute", "min": "min", "max": "max", "median": "médiane", "zero": "ne commence pas à zéro", "ratio": "échelle de rapport",
           "dec": ",", "thou": " "},
}
UNSTORED = "non stocké"
DOC_ID = re.compile(r"doc_[0-9a-f]{12}")
# Run options set by `configure`; `unstored` turns true when a row has no stored document.
OPTIONS = {"locale": "en", "allow_unstored": False, "unstored": False}


def configure(locale="en", allow_unstored=False):
    if locale not in WORDS:
        raise StyleError(f"unknown locale: {locale}")
    OPTIONS.update(locale=locale, allow_unstored=allow_unstored, unstored=False)


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
    have = {f.name for f in font_manager.fontManager.ttflist}
    if "Roboto Condensed" not in have:
        warnings.warn("Roboto Condensed is not installed: text is measured with DejaVu Sans", stacklevel=2)
    plt.rcParams.update({
        "font.family": "Roboto Condensed" if "Roboto Condensed" in have else "DejaVu Sans",
        "font.size": TEXT_PT, "svg.fonttype": "none", "axes.edgecolor": AXIS,
        "text.color": INK, "axes.labelcolor": LABEL, "xtick.color": LABEL, "ytick.color": LABEL,
        "axes.facecolor": "none", "figure.facecolor": "none", "savefig.facecolor": "none",
        "axes.linewidth": 0.5, "grid.color": GRID, "grid.linewidth": 0.5,
        "legend.frameon": False, "hatch.linewidth": 0.6,
    })


register_fonts()
# The mono face of the site; DejaVu Sans Mono is the fallback.
MONO = ["JetBrains Mono", "DejaVu Sans Mono"]
_have = {f.name for f in font_manager.fontManager.ttflist}
MONO_FACE = next(f for f in MONO if f in _have or f == MONO[-1])


def new_fig(height_mm):
    return plt.figure(figsize=(WIDTH_MM * MM, height_mm * MM), layout="constrained")


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
    if unit:
        # horizontal bars carry their legend at the left, so the unit goes to the right end
        right = value_axis == "x"
        ax.text(1 if right else 0, 1.03, unit, transform=ax.transAxes, ha="right" if right else "left",
                va="bottom", color=LABEL, fontsize=TEXT_PT)


def panel_title(ax, text):
    ax.set_title(text, loc="left", fontsize=TITLE_PT, fontweight="bold", color=INK)


def num(v, places=1):
    s = f"{v:,.{places}f}"
    s = s.rstrip("0").rstrip(".") if "." in s else s
    return s.replace(",", "#").replace(".", word("dec")).replace("#", word("thou"))


def num_label(v, floor=0.1):
    """A value label; a positive value under the floor prints as '<floor'."""
    return f"<{num(floor, 6)}" if 0 < v < floor else num(v)


def label_room(chars, per_char=0.015):
    """Share of the axis width to keep free after a label of this many characters."""
    return min(0.5, per_char * chars + 0.02)


def pct(v, places=1):
    return num(v, places) + THIN + "%"


def read_data(path):
    """Read one data file of the report: columns as in packages/site/report/*.csv.

    The document is `doc_` plus 12 hex characters. With the option allow_unstored, any other
    value passes with a warning and the caption source says "non stocké".
    """
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise StyleError("the data file is empty")
    for i, r in enumerate(rows, 2):
        if not DOC_ID.fullmatch(str(r.get("document", ""))):
            if not OPTIONS["allow_unstored"]:
                raise StyleError(f"line {i}: the value has no doc_ identifier (doc_ and 12 hex characters)")
            if not OPTIONS["unstored"]:
                print(f"warning: line {i}: the document is not stored; the caption says '{UNSTORED}'",
                      file=sys.stderr)
            OPTIONS["unstored"] = True
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
    e = html.escape
    unit = f" ({e(meta['unit'])})" if meta.get("unit") else ""
    source = meta["source"]
    if OPTIONS["unstored"]:
        source = f"{source.rstrip('.')} ({UNSTORED})."
    out = (f'<p class="caption"><strong>{word(kind)} {e(str(meta["number"]))}. {e(meta["title"])}{unit}.'
           f'</strong> {word("source")} {e(source)} {word("note")} {e(meta["note"])}</p>\n')
    if meta.get("address"):
        out += f'<p class="address"><code>{word("view")} → {e(meta["address"])}</code></p>\n'
    return out


def save(fig, out_dir, stem, meta, grey=False):
    """Write the SVG (text kept as text), the PNG and the caption of one figure."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    fig.savefig(out / f"{stem}.svg", transparent=True)
    fig.savefig(out / f"{stem}.png", dpi=200, transparent=False, facecolor=WHITE)
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
    gap = TEXT_PT * 1.25 * fig.dpi / 72
    for ax, items in groups:
        ys = [ax.transData.transform((x, y))[1] for x, y, _, _ in items]
        for (x, y, text, color), y0, y1 in zip(items, ys, spread(ys, gap)):
            dy = (y1 - y0) * 72 / fig.dpi
            ax.annotate(text, (x, y), xytext=(8, dy), textcoords="offset points", va="center", color=color,
                        fontsize=TEXT_PT, annotation_clip=False,
                        arrowprops=dict(arrowstyle="-", color=color, lw=0.5, shrinkA=0, shrinkB=2)
                        if abs(dy) > 0.5 else None)
