"""Satellite plate frame: a before and an after image of the same size and scale.

Data file (JSON): before and after {image, date_utc, sensor, scene, bands}, pixel_m, scale_bar_m,
marks [{x, y, w, h}] in pixels. Image paths are relative to the data file. The note of the
caption gives the stretch.
"""
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

import style as st


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    base = st.Path(data).parent
    imgs = {k: plt.imread(base / d[k]["image"]) for k in ("before", "after")}
    if imgs["before"].shape[:2] != imgs["after"].shape[:2]:
        raise st.StyleError("the two images must have the same size")
    h, w = imgs["before"].shape[:2]
    fig = st.new_fig(meta.get("height_mm", 20 + 70 * h / w))
    for i, k in enumerate(("before", "after")):
        ax = fig.add_subplot(1, 2, i + 1)
        ax.imshow(imgs[k], cmap="gray" if imgs[k].ndim == 2 else None)
        ax.axis("off")
        info = d[k]
        ax.set_title(f"{k.capitalize()} · {info['date_utc']} UTC", loc="left", fontsize=st.TITLE_PT,
                     fontweight="bold")
        ax.text(0, -0.03, info["sensor"], transform=ax.transAxes, va="top", fontsize=st.NOTE_PT)
        ax.text(0, -0.09, info["scene"], transform=ax.transAxes, va="top", fontsize=st.NOTE_PT, family=st.MONO_FACE)
        ax.text(0, -0.15, info["bands"], transform=ax.transAxes, va="top", fontsize=st.NOTE_PT)
        for m in d.get("marks", []):
            for lw, color in ((3, "#000000"), (1.2, st.WHITE)):  # dark halo, thin white outline
                ax.add_patch(Rectangle((m["x"], m["y"]), m["w"], m["h"], fill=False, edgecolor=color,
                                       linewidth=lw))
        if i == 1:  # one scale bar and one north arrow, on the last plate
            length = d["scale_bar_m"] / d["pixel_m"]
            ax.plot([w * 0.05, w * 0.05 + length], [h * 0.94] * 2, color=st.WHITE, linewidth=2.5,
                    solid_capstyle="butt")
            ax.text(w * 0.05, h * 0.9, f"{d['scale_bar_m']:,} m", color=st.WHITE, fontsize=st.NOTE_PT)
            ax.annotate("N", (w * 0.93, h * 0.08), xytext=(w * 0.93, h * 0.22), color=st.WHITE, ha="center",
                        fontsize=st.NOTE_PT, arrowprops=dict(arrowstyle="-|>", color=st.WHITE, lw=1))
    return st.save(fig, out_dir, meta["stem"], meta, grey)
