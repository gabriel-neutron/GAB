"""Key-figure tiles: a big number, its unit and a label, three tiles a row at most.

Data file (JSON): tiles [{value, unit, label, source}]. The source key is checked but not drawn: the caption holds it. A value is a number (written in the
locale, with `places` decimals, 1 by default) or a text. No box and no hue: a hairline above each tile.
"""
import textwrap

import style as st

PER_ROW = 3


def build(data, meta, out_dir, grey=False):
    tiles = st.read_json(data)["tiles"]
    if not tiles:
        raise st.StyleError("no tile")
    st.need_sources(tiles, "a tile")
    per = min(PER_ROW, len(tiles))
    nrows = -(-len(tiles) // per)
    value_pt = meta.get("value_pt", 30)
    height = st.size_height(meta, 8 + 36 * nrows)
    fig = st.new_fig(height)
    ax = fig.add_subplot()
    ax.set_xlim(0, per)
    ax.set_ylim(-nrows, 0)
    ax.axis("off")
    row_mm = height / nrows
    at = lambda y, mm: y - mm / row_mm  # a distance in mm below the top of the row, in row units
    for i, t in enumerate(tiles):
        x, y = i % per, -(i // per)
        v = t["value"]
        v = st.num(v, t.get("places", 1)) if isinstance(v, (int, float)) else v
        ax.plot([x + 0.04, x + 0.94], [at(y, 1)] * 2, color=st.AXIS, linewidth=0.8)
        ax.text(x + 0.04, at(y, 3.5), v, fontsize=value_pt, fontweight="bold", color=st.INK, va="top")
        ax.text(x + 0.04, at(y, 4 + value_pt * 0.3528 * 1.15), t.get("unit", ""), fontsize=st.TEXT_PT, color=st.LABEL, va="top")
        ax.text(x + 0.04, at(y, 9.5 + value_pt * 0.3528 * 1.15), textwrap.fill(t["label"], 30), fontsize=st.TEXT_PT, color=st.INK, va="top")
    return st.save(fig, out_dir, meta["stem"], meta, grey)
