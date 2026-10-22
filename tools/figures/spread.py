"""Median and quartiles of a group: serie = group, periode = item or statistic, valeur = value.

Two forms of the data file. One row for each item: the tool computes min, Q1, median, Q3 and
max of each group and draws the items as points. Summary rows: the periode of the rows of a
group are min, q1, median, q3 and max (the five values are all the file holds, no points).
Meta key zero: the axis starts at zero; else the note must say that it does not.
"""
import numpy as np

import style as st
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

STATS = ("min", "q1", "median", "q3", "max")


def summary(group_rows):
    named = {r["periode"].strip().lower(): r["valeur"] for r in group_rows}
    if set(STATS) <= set(named):
        five = [named[k] for k in STATS]
        pts = []
    else:
        pts = sorted(r["valeur"] for r in group_rows)
        if len(pts) < 3:
            raise st.StyleError(f"'{group_rows[0]['serie']}': give three items or the five summary rows")
        five = [pts[0], *np.percentile(pts, [25, 50, 75]), pts[-1]]
    if five != sorted(five):
        raise st.StyleError(f"'{group_rows[0]['serie']}': min, Q1, median, Q3 and max are not in order")
    return five, pts


def build(data, meta, out_dir, grey=False):
    rows = st.read_data(data)
    zero = bool(meta.get("zero"))
    st.require_axis_note(meta, zero, False)
    stats = {g: summary([r for r in rows if r["serie"] == g]) for g in st.order(rows, "serie")}
    groups = sorted(stats, key=lambda g: stats[g][0][2])
    fig = st.new_fig(meta.get("height_mm", 22 + 9 * len(groups)))
    ax = fig.add_subplot()
    st.style_axes(ax, meta.get("unit", ""), value_axis="x")
    for i, g in enumerate(groups):
        (lo, q1, med, q3, hi), pts = stats[g]
        ax.plot([lo, hi], [i, i], color=st.SECOND, lw=1, solid_capstyle="butt")
        ax.barh(i, q3 - q1, left=q1, height=0.46, color=st.CONTEXT, edgecolor=st.SECOND, linewidth=0.6)
        ax.plot(med, i, "|", color=st.INK, markersize=12, markeredgewidth=2)
        for k, v in enumerate(pts):
            ax.plot(v, i + (-0.3 if k % 2 else 0.3), "o", color=st.INK, markersize=2.2, alpha=0.7)
        ax.annotate(f"{st.word('median')} {st.num(med)}", (hi, i), xytext=(6, 0), textcoords="offset points", va="center",
                    fontsize=st.TEXT_PT)
    top = max(stats[g][0][4] for g in groups)
    ax.set_yticks(range(len(groups)), groups)
    ax.set_ylim(-0.7, len(groups) - 0.3)
    low = 0 if zero else min(stats[g][0][0] for g in groups)
    ax.set_xlim(low if zero else low - (top - low) * 0.03, low + (top - low) / (1 - st.label_room(len(st.word("median")) + 5)))
    ax.legend(handles=[Line2D([], [], color=st.SECOND, lw=1, label=f"{st.word('min')}–{st.word('max')}"),
                       Patch(facecolor=st.CONTEXT, edgecolor=st.SECOND, label="Q1–Q3"),
                       Line2D([], [], marker="|", color=st.INK, markersize=10, markeredgewidth=2,
                              linestyle="", label=st.word("median"))],
              loc="lower left", bbox_to_anchor=(0, 1.0), ncol=3, fontsize=st.TEXT_PT, borderaxespad=0)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
