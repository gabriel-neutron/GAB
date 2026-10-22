"""Stacked share bars: serie = part, periode = bar, valeur = share. Five parts at most.

Parts take ordered greys, light to dark, with a white gap. Each part is labelled in the bar
where it is thickest; a part under 4 % is labelled at the right end of that bar.
"""
import style as st

THIN_PART = 4


def build(data, meta, out_dir, grey=False):
    rows = st.read_data(data)
    parts, bars = st.order(rows, "serie"), st.order(rows, "periode")
    if len(parts) > len(st.GREY_STEPS):
        raise st.StyleError(f"a stacked bar holds {len(st.GREY_STEPS)} parts at most")
    val = {(r["serie"], r["periode"]): r["valeur"] for r in rows}
    fig = st.new_fig(meta.get("height_mm", 30 + 12 * len(bars)))
    ax = fig.add_subplot()
    st.style_axes(ax, meta.get("unit", ""), value_axis="x")
    left = {b: 0.0 for b in bars}
    for p, color in zip(parts, st.GREY_STEPS):
        best = max(bars, key=lambda b: val.get((p, b), 0))
        for i, b in enumerate(bars):
            v = val.get((p, b), 0)
            ax.barh(i, v, left=left[b], height=0.6, color=color, edgecolor=st.WHITE, linewidth=2)
            if b == best and v >= THIN_PART:
                ink = st.WHITE if st.lightness(color) < 0.55 else st.INK
                ax.text(left[b] + v / 2, i, p, ha="center", va="center", color=ink, fontsize=st.TEXT_PT)
            elif b == best and v > 0:
                ax.text(sum(val.get((q, b), 0) for q in parts) + 1, i, p, ha="left", va="center",
                        color=st.INK, fontsize=st.TEXT_PT)
            left[b] += v
    ax.set_yticks(range(len(bars)), bars)
    ax.invert_yaxis()
    ax.set_xlim(0, max(left.values()) * 1.12)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
