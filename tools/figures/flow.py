"""Flow diagram: boxes in a grid and arrows between them. Value chain, method, trees.

Data file (JSON): rows (names of the layers, top to bottom), cols (number of columns),
nodes [{id, label, col, row, state}], edges [{from, to, source, state, label?}].
A node state is "solid", "dashed" or "hatched" (hatched: not documented). An edge state is "solid"
or "dashed". An edge needs a source key, and no edge may touch a hatched node: the report
draws no arrow where it has no source. Col and row may be fractions. No hue is used.
"""
import textwrap

from matplotlib.patches import Rectangle

import style as st

NODE_STATES = ("solid", "dashed", "hatched")
EDGE_STATES = ("solid", "dashed")


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    nodes = {n["id"]: n for n in d["nodes"]}
    for n in d["nodes"]:
        if n.get("state", "solid") not in NODE_STATES:
            raise st.StyleError(f"unknown node state: {n['state']}")
    for e in d["edges"]:
        if e.get("state", "solid") not in EDGE_STATES:
            raise st.StyleError(f"unknown edge state: {e['state']}")
        if e["from"] not in nodes or e["to"] not in nodes:
            raise st.StyleError(f"edge names an unknown node: {e['from']} -> {e['to']}")
        if "hatched" in (nodes[e["from"]].get("state"), nodes[e["to"]].get("state")):
            raise st.StyleError(f"an arrow touches a hatched node: {e['from']} -> {e['to']}")
    st.need_sources(d["edges"], "an edge")
    cols, rows = d["cols"], d.get("rows") or []
    nrows = max([len(rows)] + [int(n["row"]) + 1 for n in d["nodes"]])
    fig = st.new_fig(st.size_height(meta, 24 + 26 * nrows))
    ax = fig.add_subplot()
    left = 0.9 if rows else 0.0
    ax.set_xlim(-left - 0.5, cols - 0.5)
    ax.set_ylim(-nrows + 0.45, 0.55)
    ax.axis("off")
    bw, bh = 0.84, 0.62
    chars = max(8, int(st.WIDTH_MM / (cols + left) * bw / 1.7))
    for i, name in enumerate(rows):
        ax.text(-left - 0.45, -i, textwrap.fill(name, 12), ha="left", va="center", fontsize=st.TEXT_PT, fontweight="bold",
                color=st.LABEL)
    for e in d["edges"]:
        (x1, y1), (x2, y2) = [(nodes[k]["col"], -nodes[k]["row"]) for k in (e["from"], e["to"])]
        # leave from the side facing the target: horizontal when rows match, else vertical
        if y1 == y2:
            a, b = (x1 + bw / 2 * (1 if x2 > x1 else -1), y1), (x2 - bw / 2 * (1 if x2 > x1 else -1), y2)
        else:
            a, b = (x1, y1 + bh / 2 * (1 if y2 > y1 else -1)), (x2, y2 - bh / 2 * (1 if y2 > y1 else -1))
        ax.annotate("", b, xytext=a, arrowprops=dict(
            arrowstyle="-|>", color=st.SECOND, lw=1, mutation_scale=st.ARROW, shrinkA=0, shrinkB=0,
            linestyle="-" if e.get("state", "solid") == "solid" else (0, (4, 3))))
        # the source key sits on the arrow: no arrow without its source in view
        ax.text((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, " ".join(filter(None, (e.get("label"), e["source"]))), ha="center", va="bottom",
                    fontsize=st.NOTE_PT, color=st.LABEL)
    for n in d["nodes"]:
        x, y, state = n["col"], -n["row"], n.get("state", "solid")
        ax.add_patch(Rectangle((x - bw / 2, y - bh / 2), bw, bh, facecolor=st.WHITE if state != "hatched" else st.BAND,
                               edgecolor=st.INK if state == "solid" else st.SECOND, linewidth=0.8,
                               linestyle="-" if state != "dashed" else (0, (4, 3)),
                               hatch="///" if state == "hatched" else None))
        ax.text(x, y, textwrap.fill(n["label"], chars), ha="center", va="center", fontsize=st.TEXT_PT,
                color=st.INK, linespacing=1.1,
                bbox=dict(facecolor=st.BAND, edgecolor="none", pad=1.5) if state == "hatched" else None)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
