"""Line chart: one data file in the report columns (serie, periode, valeur, ...).

Meta keys: mirror (series drawn dashed), annotations ([{n, text, serie, periode, panel, offset}]: a numbered disc at a point, the note under the figure), zero (axis starts at zero),
ratio (base of a ratio scale, for a log axis with percentage-change ticks).
Optional column `panel`: one small multiple for each value, stacked, sharing one caption.
End labels that come close move apart and get a leader line.
"""
import textwrap

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
    groups = []
    for k, (ax, panel) in enumerate(zip(axes, panels)):
        sub = [r for r in rows if r.get("panel", "") == panel]
        series, periods = st.order(sub, "serie"), st.order(sub, "periode")
        if len(series) > len(st.SERIES):
            raise st.StyleError(f"a line chart holds {len(st.SERIES)} series at most: split it in panels")
        marks = st.check_marks(st.SERIES[:len(series)])
        unit = (sub[0].get("unite") if panel else "") or meta.get("unit", "")
        st.style_axes(ax, "" if panel else unit)
        if panel:
            st.panel_title(ax, f"{panel} ({unit})" if unit else panel, letter=chr(65 + k))
        items = []
        for s, m in zip(series, marks):
            pts = {r["periode"]: r["valeur"] for r in sub if r["serie"] == s}
            xs = [i for i, p in enumerate(periods) if p in pts]
            ys = [pts[periods[i]] for i in xs]
            dashed = s in mirror
            ax.plot(xs, ys, color=m.color, linestyle="--" if dashed else "-", marker=m.marker,
                    markersize=st.MARKER, linewidth=st.LINE_W, markerfacecolor=st.PAPER,
                    markeredgecolor=m.color, markeredgewidth=st.LINE_W)
            # a narrow figure writes the name above the value, wrapped, to keep the room for the lines
            end = f"{textwrap.fill(s, 12, break_long_words=False)}{chr(10)}{st.num(ys[-1])}" if st.scale() > 1.5 else f"{s} {st.num(ys[-1])}"
            items.append((xs[-1], ys[-1], end, m.color))
        short = st.scale() > 1.5 and all(p.isdigit() and len(p) == 4 for p in periods)
        ax.set_xticks(range(len(periods)), ["'" + p[2:] for p in periods] if short else periods)
        ax.set_xlim(-0.2, len(periods) - 1 + 0.2)
        ax.margins(y=0.08)
        if ratio:
            ax.set_yscale("log")
            ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{(v / ratio - 1) * 100:+.0f}{st.THIN}%"))
            ax.yaxis.set_minor_formatter(NullFormatter())
        elif zero:
            ax.set_ylim(bottom=0)
        groups.append((ax, items))
        for a in meta.get("annotations", []):
            if a.get("panel", "") == panel:
                y = next(r["valeur"] for r in sub if r["serie"] == a["serie"] and r["periode"] == a["periode"])
                st.note_mark(ax, periods.index(a["periode"]), y, a["n"], *a.get("offset", (10, 8)))
    st.end_labels(fig, groups)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
