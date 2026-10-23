"""Line chart: one data file in the report columns (serie, periode, valeur, ...).

Meta keys: mirror (series drawn dashed with hollow markers), zero (axis starts at zero),
ratio (base of a ratio scale, for a log axis with percentage-change ticks).
Optional column `panel`: one small multiple for each value, stacked, sharing one caption.
End labels that come close move apart and get a leader line.
"""
import style as st
from matplotlib.ticker import FuncFormatter, NullFormatter


def build(data, meta, out_dir, grey=False):
    rows = st.read_data(data)
    panels = list(dict.fromkeys(r.get("panel", "") for r in rows))
    zero, ratio = bool(meta.get("zero")), meta.get("ratio")
    st.require_axis_note(meta, zero, bool(ratio))
    mirror = set(meta.get("mirror", []))
    fig = st.new_fig(st.size_height(meta, 80 if len(panels) == 1 else 20 + 62 * len(panels)))
    axes = fig.subplots(len(panels), 1, squeeze=False)[:, 0]
    groups, longest = [], 0
    for ax, panel in zip(axes, panels):
        sub = [r for r in rows if r.get("panel", "") == panel]
        series, periods = st.order(sub, "serie"), st.order(sub, "periode")
        if len(series) > len(st.SERIES):
            raise st.StyleError(f"a line chart holds {len(st.SERIES)} series at most: split it in panels")
        marks = st.check_marks(st.SERIES[:len(series)])
        unit = (sub[0].get("unite") if panel else "") or meta.get("unit", "")
        st.style_axes(ax, "" if panel else unit)
        if panel:
            st.panel_title(ax, f"{panel} ({unit})" if unit else panel)
        items = []
        for s, m in zip(series, marks):
            pts = {r["periode"]: r["valeur"] for r in sub if r["serie"] == s}
            xs = [i for i, p in enumerate(periods) if p in pts]
            ys = [pts[periods[i]] for i in xs]
            dashed = s in mirror
            ax.plot(xs, ys, color=m.color, linestyle="--" if dashed else "-", marker=m.marker,
                    markersize=st.MARKER, linewidth=st.LINE_W, markerfacecolor="white" if dashed else m.color,
                    markeredgecolor=m.color, markevery=[0, len(xs) - 1])
            # start value hollow, end value filled
            ax.plot(xs[0], ys[0], marker=m.marker, markersize=st.MARKER, markerfacecolor="white",
                    markeredgecolor=m.color, linestyle="")
            items.append((xs[-1], ys[-1], f"{s} {st.num(ys[-1])}", m.color))
            longest = max(longest, len(items[-1][2]))
        ax.set_xticks(range(len(periods)), periods)
        ax.set_xlim(-0.2, len(periods) - 1 + 0.2)
        ax.margins(y=0.08)
        if ratio:
            ax.set_yscale("log")
            ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{(v / ratio - 1) * 100:+.0f}{st.THIN}%"))
            ax.yaxis.set_minor_formatter(NullFormatter())
        elif zero:
            ax.set_ylim(bottom=0)
        groups.append((ax, items))
    # room on the right for the longest end label
    fig.get_layout_engine().set(rect=(0, 0, 1 - min(0.4, 0.011 * longest + 0.04), 1))
    st.end_labels(fig, groups)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
