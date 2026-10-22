"""Dot plot: one dot for each category (serie), optionally one marker shape for each group (periode).

Meta keys: log (log axis: the note must say the ratio scale), zero (a linear axis starts at zero; the
default), label_floor (a value under it prints as "<0.1"), unit_column (write the `unite` of each
category in a column at the right).
"""
import style as st
from matplotlib.lines import Line2D
from matplotlib.ticker import FuncFormatter, NullFormatter


def build(data, meta, out_dir, grey=False):
    rows = st.read_data(data)
    groups, cats = st.order(rows, "periode"), st.order(rows, "serie")
    if len(groups) > len(st.SERIES):
        raise st.StyleError(f"a dot plot holds {len(st.SERIES)} groups at most")
    log = bool(meta.get("log"))
    if log and any(r["valeur"] <= 0 for r in rows):
        raise st.StyleError("a log axis needs values above zero")
    zero = meta.get("zero", True)
    st.require_axis_note(meta, zero and not log, log)
    marks = st.check_marks(st.SERIES[:len(groups)])
    top = {c: max(r["valeur"] for r in rows if r["serie"] == c) for c in cats}
    cats.sort(key=top.get)
    floor = meta.get("label_floor", 0.1)
    fig = st.new_fig(meta.get("height_mm", 16 + 7 * len(cats)))
    ax = fig.add_subplot()
    st.style_axes(ax, meta.get("unit", ""), value_axis="x")
    unit_of = {}
    for r in rows:
        unit_of.setdefault(r["serie"], r.get("unite", ""))
    for r in rows:
        m = marks[groups.index(r["periode"])]
        i = cats.index(r["serie"])
        ax.plot(r["valeur"], i, m.marker, color=m.color, markersize=st.MARKER + 1)
        ax.annotate(st.num_label(r["valeur"], floor), (r["valeur"], i), xytext=(6, 0), textcoords="offset points",
                    va="center", fontsize=st.TEXT_PT)
    if meta.get("unit_column"):
        for i, c in enumerate(cats):
            ax.text(1.03, i, unit_of[c], transform=ax.get_yaxis_transform(), va="center", color=st.LABEL,
                    fontsize=st.TEXT_PT)
        fig.get_layout_engine().set(rect=(0, 0, 0.86, 1))
    vmax = max(top.values())
    chars = max(len(st.num_label(r["valeur"], floor)) for r in rows)
    ax.set_yticks(range(len(cats)), cats)
    ax.set_ylim(-0.6, len(cats) - 0.4)
    if log:
        ax.set_xscale("log")
        ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: st.num(v, 6)))
        ax.xaxis.set_minor_formatter(NullFormatter())
        lo = min(r["valeur"] for r in rows)
        span = max(vmax / lo, 2)
        ax.set_xlim(lo / span ** 0.05, vmax * span ** (0.05 + st.label_room(chars)))
    else:
        lo = 0 if zero else min(r["valeur"] for r in rows)
        low = lo if zero else lo - (vmax - lo or abs(lo) or 1) * 0.05
        ax.set_xlim(low, low + (vmax - low) / (1 - st.label_room(chars)))
    if len(groups) > 1:
        ax.legend(handles=[Line2D([], [], marker=m.marker, color=m.color, linestyle="", label=g)
                           for g, m in zip(groups, marks)],
                  loc="lower left", bbox_to_anchor=(0, 1.0), ncol=len(groups), fontsize=st.TEXT_PT, borderaxespad=0)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
