"""Line chart: one data file in the report columns (serie, periode, valeur, ...).

Meta keys: mirror (series drawn dashed with hollow markers), zero (axis starts at zero),
ratio (base of a ratio scale, for a log axis with percentage-change ticks).
"""
import style as st
from matplotlib.ticker import FuncFormatter, NullFormatter


def build(data, meta, out_dir, grey=False):
    rows = st.read_data(data)
    series, periods = st.order(rows, "serie"), st.order(rows, "periode")
    if len(series) > len(st.SERIES):
        raise st.StyleError(f"a line chart holds {len(st.SERIES)} series at most: split it in panels")
    marks = st.check_marks(st.SERIES[:len(series)])
    zero, ratio = bool(meta.get("zero")), meta.get("ratio")
    st.require_axis_note(meta, zero, bool(ratio))
    mirror = set(meta.get("mirror", []))
    fig = st.new_fig(meta.get("height_mm", 80))
    ax = fig.add_subplot()
    st.style_axes(ax, meta.get("unit", ""))
    for s, m in zip(series, marks):
        pts = {r["periode"]: r["valeur"] for r in rows if r["serie"] == s}
        xs = [i for i, p in enumerate(periods) if p in pts]
        ys = [pts[periods[i]] for i in xs]
        dashed = s in mirror
        ax.plot(xs, ys, color=m.color, linestyle="--" if dashed else "-", marker=m.marker,
                markersize=st.MARKER, linewidth=st.LINE_W, markerfacecolor="white" if dashed else m.color,
                markeredgecolor=m.color, markevery=[0, len(xs) - 1])
        # start value hollow, end value filled
        ax.plot(xs[0], ys[0], marker=m.marker, markersize=st.MARKER, markerfacecolor="white",
                markeredgecolor=m.color, linestyle="")
        label = f"{s} {st.num(ys[-1])}"
        st.end_label(ax, xs[-1], ys[-1], label, m.color)
    ax.set_xticks(range(len(periods)), periods)
    ax.set_xlim(-0.2, len(periods) - 1 + 0.2)
    ax.margins(y=0.08)
    if ratio:
        ax.set_yscale("log")
        ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{(v / ratio - 1) * 100:+.0f}{st.THIN}%"))
        ax.yaxis.set_minor_formatter(NullFormatter())
    elif zero:
        ax.set_ylim(bottom=0)
    # room on the right for the end labels
    fig.get_layout_engine().set(rect=(0, 0, 0.82, 1))
    return st.save(fig, out_dir, meta["stem"], meta, grey)
