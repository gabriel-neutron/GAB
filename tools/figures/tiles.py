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
    fig = st.new_fig(st.size_height(meta, 8 + 26 * nrows))
    ax = fig.add_subplot()
    ax.set_xlim(0, per)
    ax.set_ylim(-nrows, 0)
    ax.axis("off")
    for i, t in enumerate(tiles):
        x, y = i % per, -(i // per)
        v = t["value"]
        v = st.num(v, t.get("places", 1)) if isinstance(v, (int, float)) else v
        ax.plot([x + 0.04, x + 0.94], [y - 0.04] * 2, color=st.AXIS, linewidth=0.8)
        ax.text(x + 0.04, y - 0.12, v, fontsize=26, fontweight="bold", color=st.INK, va="top")
        ax.text(x + 0.04, y - 0.46, t.get("unit", ""), fontsize=st.TEXT_PT, color=st.LABEL, va="top")
        ax.text(x + 0.04, y - 0.58, textwrap.fill(t["label"], 34), fontsize=st.TEXT_PT, color=st.INK, va="top")
    return st.save(fig, out_dir, meta["stem"], meta, grey)
