"""Dot matrix: candidates in rows, conditions in columns, one mark in each cell.

Data file (JSON): conditions [names], rows [{label, marks}] with a mark "full", "half" or "empty"
for each condition. A filled disc, a half disc and an open ring: the shape carries the meaning,
no hue. The caption file may hold `legend` {full, half, empty} to word the three marks.
"""
from matplotlib.patches import Circle, Wedge

import style as st

MARKS = ("full", "half", "empty")
R = 0.3


def draw(ax, x, y, mark):
    ring = dict(edgecolor=st.INK, linewidth=1)
    if mark == "full":
        ax.add_patch(Circle((x, y), R, facecolor=st.INK, **ring))
    elif mark == "half":
        ax.add_patch(Circle((x, y), R, facecolor=st.PAPER, **ring))
        ax.add_patch(Wedge((x, y), R, 90, 270, facecolor=st.INK, edgecolor=st.INK, linewidth=1))
    else:
        ax.add_patch(Circle((x, y), R, facecolor=st.PAPER, **ring))


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    conds, rows = d["conditions"], d["rows"]
    for r in rows:
        if len(r["marks"]) != len(conds) or any(m not in MARKS for m in r["marks"]):
            raise st.StyleError(f"bad marks for: {r['label']}")
    fig = st.new_fig(st.size_height(meta, 30 + 8 * len(rows)))
    ax = fig.add_subplot()
    ax.set_aspect("equal", adjustable="datalim")
    ax.set_xlim(-0.6, len(conds) - 0.4)
    ax.set_ylim(-len(rows) - 2.0, 1.2)
    ax.axis("off")
    for j, c in enumerate(conds):
        ax.text(j, 0.75, c, ha="center", va="bottom", fontsize=st.TITLE_PT, fontweight=st.SEMIBOLD)
    for i, r in enumerate(rows):
        ax.text(-0.6, -i, r["label"], ha="right", va="center", fontsize=st.TEXT_PT)
        ax.axhline(-i - 0.5, color=st.GRID, linewidth=0.5, zorder=0)
        for j, m in enumerate(r["marks"]):
            draw(ax, j, -i, m)
    words = {**{k: st.word(k) for k in MARKS}, **meta.get("legend", {})}
    for k, m in enumerate(MARKS):
        y = -len(rows) - 0.1 - k * 0.7
        draw(ax, -0.2, y, m)
        ax.text(0.2, y, words[m], va="center", fontsize=st.NOTE_PT)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
