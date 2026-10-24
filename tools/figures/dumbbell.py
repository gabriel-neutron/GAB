"""Dumbbell: one row per category, two periods (the first in the file is the start)."""
import style as st


def build(data, meta, out_dir, grey=False):
    rows = st.read_data(data)
    periods = st.order(rows, "periode")
    if len(periods) != 2:
        raise st.StyleError("a dumbbell needs two periods")
    cats = st.order(rows, "serie")
    val = {(r["serie"], r["periode"]): r["valeur"] for r in rows}
    if len(val) != len(cats) * 2:
        raise st.StyleError("each category needs a value in both periods")
    st.require_axis_note(meta, True, False)
    cats.sort(key=lambda c: val[(c, periods[1])])
    fig = st.new_fig(st.size_height(meta, 16 + 7 * len(cats)))
    ax = fig.add_subplot()
    st.style_axes(ax, meta.get("unit", ""), value_axis="x")
    for i, c in enumerate(cats):
        a, b = val[(c, periods[0])], val[(c, periods[1])]
        ax.annotate("", (b, i), xytext=(a, i), arrowprops=dict(arrowstyle="-|>", color=st.SECOND,
                    lw=1, shrinkA=3, shrinkB=3, mutation_scale=st.ARROW))
        ax.plot(a, i, "o", markersize=st.MARKER + 1, markerfacecolor=st.PAPER, markeredgecolor=st.INK, markeredgewidth=st.LINE_W)
        ax.plot(b, i, "o", markersize=st.MARKER + 1, color=st.INK)
        ax.annotate(st.num(b), (b, i), xytext=(6, 0), textcoords="offset points", va="center",
                    ha="left" if b >= a else "right", fontsize=st.TEXT_PT)
    ax.set_yticks(range(len(cats)), cats)
    ax.set_ylim(-0.6, len(cats) - 0.4)
    ax.set_xlim(0, max(val.values()) / (1 - st.label_room(max(len(st.num(v)) for v in val.values()) + 1)))
    ax.plot([], [], "o", markerfacecolor=st.PAPER, markeredgecolor=st.INK, markeredgewidth=st.LINE_W, label=periods[0])
    ax.plot([], [], "o", color=st.INK, label=periods[1])
    ax.legend(loc="lower left", bbox_to_anchor=(0, 1.0), ncol=2, fontsize=st.TEXT_PT, borderaxespad=0)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
