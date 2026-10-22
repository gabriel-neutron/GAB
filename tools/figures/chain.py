"""Chain diagram, left to right: one column per step.

Data file (JSON): columns (names), nodes [{id, label, country, column, designated?}],
edges [{from, to, date, pair, kind}] with kind "fact" (solid) or "assessment" (dashed).
A designated node carries a small bar in its regime colour, with its hatch.
"""
from matplotlib.patches import Rectangle

import style as st
from badge import words

BOX_W, BOX_H = 0.7, 0.36


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    cols = d["columns"]
    pos, rowcount = {}, {c: 0 for c in cols}
    for n in d["nodes"]:
        if n["column"] not in rowcount:
            raise st.StyleError(f"unknown column: {n['column']}")
        pos[n["id"]] = (cols.index(n["column"]), -rowcount[n["column"]])
        rowcount[n["column"]] += 1
    rows = max(rowcount.values())
    fig = st.new_fig(meta.get("height_mm", 24 + 24 * rows))
    ax = fig.add_subplot()
    ax.set_xlim(-0.5, len(cols) - 0.5)
    ax.set_ylim(-rows + 0.5, 0.9)
    ax.axis("off")
    for i, c in enumerate(cols):
        ax.text(i, 0.65, c, ha="center", va="bottom", fontsize=st.TITLE_PT, fontweight="bold")
    for e in d["edges"]:
        words(e["pair"])
        if e["kind"] not in ("fact", "assessment"):
            raise st.StyleError(f"unknown kind: {e['kind']}")
        (x1, y1), (x2, y2) = pos[e["from"]], pos[e["to"]]
        ax.annotate("", (x2 - BOX_W / 2, y2), xytext=(x1 + BOX_W / 2, y1), arrowprops=dict(
            arrowstyle="-|>", color=st.SECOND, lw=1, mutation_scale=8, shrinkA=0, shrinkB=0,
            linestyle="-" if e["kind"] == "fact" else (0, (4, 3))))
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.08, f"{e['date']}  {e['pair']}", ha="center",
                va="bottom", fontsize=st.NOTE_PT, family=st.MONO_FACE, color=st.INK)
    for n in d["nodes"]:
        x, y = pos[n["id"]]
        ax.add_patch(Rectangle((x - BOX_W / 2, y - BOX_H / 2), BOX_W, BOX_H, fill=False,
                               edgecolor=st.INK, linewidth=0.8))
        ax.text(x, y + 0.05, n["label"], ha="center", va="center", fontsize=st.TEXT_PT, color=st.INK)
        ax.text(x, y - 0.1, n["country"], ha="center", va="center", fontsize=st.NOTE_PT, family=st.MONO_FACE,
                color=st.LABEL)
        if n.get("designated"):
            m = st.REGIMES[n["designated"]]
            ax.add_patch(Rectangle((x - BOX_W / 2, y + BOX_H / 2 - 0.05), BOX_W, 0.05, facecolor=m.color,
                                   hatch=m.hatch, edgecolor=st.WHITE, linewidth=0))
    return st.save(fig, out_dir, meta["stem"], meta, grey)
