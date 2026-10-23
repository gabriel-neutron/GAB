"""Horizontal bars, sorted. Optional column `regime` (EU, UK, US, multi) gives hue and hatch.

Meta keys: highlight (categories whose value is written; the top bar by default), label_all
(write every value), label_floor (a value under it prints as "<0.1"; 0.1 by default).

Set overlap (UpSet style): one bar per combination of sets, the category named "A + B", the
value the size of the combination. The `regime` column gives the hue, as for any bar.
"""
import style as st
from matplotlib.patches import Patch


def build(data, meta, out_dir, grey=False):
    rows = sorted(st.read_data(data), key=lambda r: r["valeur"])
    regimes = list(dict.fromkeys(r.get("regime", "") for r in rows if r.get("regime")))
    unknown = [r for r in regimes if r not in st.REGIMES]
    if unknown:
        raise st.StyleError(f"unknown regime: {unknown[0]}")
    st.check_marks([st.REGIMES[r] for r in regimes])
    high = {r["serie"] for r in rows} if meta.get("label_all") else set(meta.get("highlight", [rows[-1]["serie"]]))
    if not high & {r["serie"] for r in rows}:
        raise st.StyleError("highlight names no category of the data")
    floor = meta.get("label_floor", 0.1)

    def label(v):
        return st.num_label(v, floor)

    fig = st.new_fig(st.size_height(meta, 14 + 7 * len(rows)))
    ax = fig.add_subplot()
    st.style_axes(ax, meta.get("unit", ""), value_axis="x")
    for i, r in enumerate(rows):
        m = st.REGIMES[r["regime"]] if r.get("regime") else None
        ax.barh(i, r["valeur"], height=0.62, color=m.color if m else st.INK, hatch=m.hatch if m else "",
                edgecolor=st.WHITE, linewidth=0)
        if r["serie"] in high:
            ax.annotate(label(r["valeur"]), (r["valeur"], i), xytext=(3, 0), textcoords="offset points",
                        va="center", fontsize=st.TEXT_PT, color=st.INK)
    ax.set_yticks(range(len(rows)), [st.fit_label(r["serie"]) for r in rows])
    chars = max(len(label(r["valeur"])) for r in rows if r["serie"] in high)
    ax.set_xlim(0, max(r["valeur"] for r in rows) / (1 - st.label_room(chars)))
    if regimes:
        ax.legend(handles=[Patch(facecolor=st.REGIMES[r].color, hatch=st.REGIMES[r].hatch,
                                 edgecolor=st.WHITE, label=st.regime_label(r)) for r in regimes],
                  loc="lower left", bbox_to_anchor=(0, 1.0), ncol=st.legend_cols([st.regime_label(r) for r in regimes]), fontsize=st.TEXT_PT,
                  borderaxespad=0)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
