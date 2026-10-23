"""Stacked share bars: serie = part, periode = bar, valeur = share. Eight parts at most.

Parts take ordered greys, light to dark, with a white gap; parts six to eight repeat a grey
with a hatch. The legend names every part. A part of 6 % or more has its value in the bar. A
part that is thinner in every bar has its values in its legend entry.
Meta key upper: {part: {bar: high bound}}, drawn as a bar-end mark beside the bar.
"""
import style as st
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

THIN_PART = 6


def build(data, meta, out_dir, grey=False):
    rows = st.read_data(data)
    parts, bars = st.order(rows, "serie"), st.order(rows, "periode")
    if len(parts) > len(st.PART_FILLS):
        raise st.StyleError(f"a stacked bar holds {len(st.PART_FILLS)} parts at most")
    val = {(r["serie"], r["periode"]): r["valeur"] for r in rows}
    if len(val) != len(parts) * len(bars):
        raise st.StyleError("each part needs a value in each bar")
    for b in bars:
        if abs(sum(val[(p, b)] for p in parts) - 100) > 0.5:
            raise st.StyleError(f"the parts of {b} do not sum to 100")
    upper = meta.get("upper", {})
    for p, per_bar in upper.items():
        for b, ub in per_bar.items():
            if (p, b) not in val:
                raise st.StyleError(f"the high bound names no part or bar: {p}, {b}")
            if ub < val[(p, b)]:
                raise st.StyleError(f"the high bound of {p} in {b} is below its value")
    fig = st.new_fig(st.size_height(meta, 34 + 12 * len(bars)))
    ax = fig.add_subplot()
    st.style_axes(ax, meta.get("unit", ""), value_axis="x")
    left = {b: 0.0 for b in bars}
    reach = 0.0
    handles = []
    for p, (color, hatch) in zip(parts, st.PART_FILLS):
        shown = False
        for i, b in enumerate(bars):
            v = val[(p, b)]
            ink = st.WHITE if st.lightness(color) < 0.55 else st.INK
            # the hatch takes the ink of the part; a second outline keeps the white gap
            ax.barh(i, v, left=left[b], height=0.6, color=color, hatch=hatch, edgecolor=ink, linewidth=0)
            ax.barh(i, v, left=left[b], height=0.6, fill=False, edgecolor=st.WHITE, linewidth=2)
            if v >= THIN_PART * st.scale():
                shown = True
                ax.text(left[b] + v / 2, i, st.num(v), ha="center", va="center", color=ink, fontsize=st.TEXT_PT)
            ub = upper.get(p, {}).get(b)
            if ub is not None:
                ax.plot([left[b] + v, left[b] + ub], [i + 0.4] * 2, color=st.INK, lw=1, marker="|", markersize=6)
                reach = max(reach, left[b] + ub)
            left[b] += v
        name = p if shown else f"{p} ({' / '.join(st.num_label(val[(p, b)]) for b in bars)})"
        handles.append(Patch(facecolor=color, hatch=hatch, edgecolor=st.WHITE if st.lightness(color) < 0.55 else st.INK, label=name, linewidth=0))
    if upper:
        handles.append(Line2D([], [], color=st.INK, lw=1, marker="|", markersize=6, label=st.word("high")))
    ax.legend(handles=handles, loc="lower left", bbox_to_anchor=(0, 1.0), ncol=st.legend_cols([h.get_label() for h in handles], 4), fontsize=st.TEXT_PT,
              borderaxespad=0, columnspacing=1.2)
    ax.set_yticks(range(len(bars)), [st.fit_label(b) for b in bars])
    ax.invert_yaxis()
    ax.set_xlim(0, max(max(left.values()), reach) * 1.06)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
