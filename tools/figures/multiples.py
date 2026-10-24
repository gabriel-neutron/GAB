"""Small multiples: one small line panel for each group, on shared axes.

Data file (JSON): panels [{title, series [{name, points [[x, y]]}]}], ncols (3 by default).
The axes are shared, and the y axis starts at zero. A panel title is a short letter title
("a. Wheat"). A panel holds up to three series, told apart by grey and marker like a line chart.
"""
import style as st


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    panels = d["panels"]
    if not 2 <= len(panels) <= 9:
        raise st.StyleError("small multiples take two to nine panels")
    if any(len(p["series"]) > len(st.SERIES) for p in panels):
        raise st.StyleError(f"a panel takes at most {len(st.SERIES)} series")
    ncols = min(d.get("ncols", 3), len(panels))
    nrows = -(-len(panels) // ncols)
    fig = st.new_fig(st.size_height(meta, 14 + 42 * nrows))
    axes = fig.subplots(nrows, ncols, sharex=True, sharey=True, squeeze=False)
    top = max(y for p in panels for s in p["series"] for _, y in s["points"])
    for k, (ax, p) in enumerate(zip(axes.flat, panels)):
        st.style_axes(ax, "")
        st.panel_title(ax, p["title"], letter=st.panel_letter(k))
        for s, m in zip(p["series"], st.SERIES):
            ax.plot(*zip(*s["points"]), color=m.color, marker=m.marker, markersize=st.MARKER - 1,
                    linewidth=st.LINE_W, label=s["name"], markerfacecolor=st.PAPER, markeredgewidth=st.LINE_W)
        if len(p["series"]) > 1:
            ax.legend(fontsize=st.NOTE_PT, loc="upper left")
    for ax in list(axes.flat)[len(panels):]:
        ax.axis("off")
    axes.flat[0].set_ylim(0, top * 1.1)
    if meta.get("unit"):
        axes.flat[0].text(0, 1.2, meta["unit"], transform=axes.flat[0].transAxes, color=st.LABEL,
                          fontsize=st.TEXT_PT, va="bottom")
    return st.save(fig, out_dir, meta["stem"], meta, grey)
