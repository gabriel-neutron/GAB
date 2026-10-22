"""Map: a vector base map with point and line layers, a status style, a scale bar and a source line.

Data file (JSON): bbox [lon0, lat0, lon1, lat1], scale_km, optional basemap (a path relative to
the data file; `data/basemap.json` by default, Natural Earth, public domain), points [{id, label,
lon, lat, status, since, source, approx?}], lines [{id, label?, coords [[lon, lat]], status, since,
source}]. The status is "active", "stopped" or "exempted" and each mark carries its date (`since`)
and a source key. A point with `approx` true gets a dotted ring and the words "approximate
location" in the legend. A status has a line style and a marker shape, no hue. Labels do not
overlap: each takes the first free place around its point, and a label with no place stops the build.
"""
import math

from matplotlib.collections import PolyCollection
from matplotlib.lines import Line2D

import style as st

BASEMAP = st.HERE / "data" / "basemap.json"
STATUS = {
    "active": st.Mark("active", st.INK, marker="o", linestyle="-"),
    "stopped": st.Mark("stopped", st.SECOND, marker="s", linestyle=(0, (4, 3))),
    "exempted": st.Mark("exempted", st.CONTEXT, marker="D", linestyle=(0, (5, 2, 1, 2))),
}
# Places around a point, in points: x, y, horizontal alignment, vertical alignment. Two rings.
SLOTS = [(dx * k, dy * k, ha, va) for k in (1, 2.4) for dx, dy, ha, va in (
    (6, 4, "left", "bottom"), (6, -4, "left", "top"), (-6, 4, "right", "bottom"), (-6, -4, "right", "top"),
    (0, 7, "center", "bottom"), (0, -7, "center", "top"), (8, 0, "left", "center"), (-8, 0, "right", "center"))]


def place_labels(fig, ax, items):
    """Give each label the first slot that stays inside the map and overlaps no label placed."""
    fig.canvas.draw()
    renderer = st.renderer(fig)
    frame = ax.get_window_extent(renderer)
    taken = []
    for x, y, text in items:
        for dx, dy, ha, va in SLOTS:
            t = ax.annotate(text, (x, y), xytext=(dx, dy), textcoords="offset points", ha=ha, va=va,
                            fontsize=st.NOTE_PT, color=st.INK)
            box = t.get_window_extent(renderer).expanded(1.05, 1.15)
            if frame.contains(box.x0, box.y0) and frame.contains(box.x1, box.y1) \
                    and not any(box.overlaps(b) for b in taken):
                taken.append(box)
                break
            t.remove()
        else:
            raise st.StyleError(f"no free place for the label: {text}")


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    pts, lns = d.get("points", []), d.get("lines", [])
    for item in pts + lns:
        if item.get("status") not in STATUS:
            raise st.StyleError(f"unknown status: {item.get('status')}")
        if not str(item.get("since", "")).strip():
            raise st.StyleError(f"a mark has no date for its status: {item.get('id') or item.get('label')}")
    st.need_sources(pts, "a point")
    st.need_sources(lns, "a line")
    st.check_marks(STATUS.values())
    base = st.read_json(st.Path(data).parent / d["basemap"] if d.get("basemap") else BASEMAP)
    lon0, lat0, lon1, lat1 = d["bbox"]
    bx = base.get("bbox")
    if bx and not (bx[0] <= lon0 and bx[1] <= lat0 and lon1 <= bx[2] and lat1 <= bx[3]):
        raise st.StyleError(f"the map lies outside the base map: {bx}")
    mid = (lat0 + lat1) / 2
    fig = st.new_fig(st.size_height(meta, 12 + st.WIDTH_MM * (lat1 - lat0) / ((lon1 - lon0) * math.cos(math.radians(mid)))))
    ax = fig.add_subplot()
    ax.add_collection(PolyCollection(base["polygons"], facecolors=st.BAND, edgecolors=st.AXIS, linewidths=0.4))
    ax.set_xlim(lon0, lon1)
    ax.set_ylim(lat0, lat1)
    ax.set_aspect(1 / math.cos(math.radians(mid)), adjustable="datalim")
    ax.axis("off")
    for ln in lns:
        m = STATUS[ln["status"]]
        ax.plot(*zip(*ln["coords"]), color=m.color, linestyle=m.linestyle, linewidth=1.8 if ln["status"] != "stopped" else 1.4,
                solid_capstyle="butt")
    for p in pts:
        m = STATUS[p["status"]]
        ax.plot(p["lon"], p["lat"], marker=m.marker, markersize=st.MARKER + 2, color=m.color,
                markerfacecolor=st.WHITE if p["status"] == "stopped" else m.color, markeredgewidth=1, linestyle="")
        if p.get("approx"):
            ax.plot(p["lon"], p["lat"], marker="o", markersize=st.MARKER + 9, markerfacecolor="none",
                    markeredgecolor=st.SECOND, markeredgewidth=0.8, linestyle="")
    km = d["scale_km"]
    deg = km / (111.32 * math.cos(math.radians(mid)))
    x0, y0 = lon0 + 0.03 * (lon1 - lon0), lat0 + 0.05 * (lat1 - lat0)
    ax.plot([x0, x0 + deg], [y0, y0], color=st.INK, linewidth=2, solid_capstyle="butt")
    ax.text(x0, y0 + 0.015 * (lat1 - lat0), f"{km} km", fontsize=st.NOTE_PT, color=st.INK, va="bottom")
    ax.text(0.99, 0.01, st.word("basemap"), transform=ax.transAxes, ha="right", va="bottom", fontsize=st.NOTE_PT,
            color=st.LABEL)
    used = list(dict.fromkeys(i["status"] for i in pts + lns))
    handles = [Line2D([], [], color=STATUS[s].color, linestyle=STATUS[s].linestyle, marker=STATUS[s].marker,
                      markerfacecolor=st.WHITE if s == "stopped" else STATUS[s].color, linewidth=1.6, markersize=5,
                      label=st.word(s)) for s in used]
    if any(p.get("approx") for p in pts):
        handles.append(Line2D([], [], linestyle="", marker="o", markersize=9, markerfacecolor="none",
                              markeredgecolor=st.SECOND, markeredgewidth=0.8, label=st.word("approx")))
    ax.legend(handles=handles, loc="lower left", bbox_to_anchor=(0, 1.0), ncol=len(handles), fontsize=st.TEXT_PT,
              borderaxespad=0)
    labels = [(p["lon"], p["lat"], f"{p['label']} · {p['since']}") for p in pts]
    labels += [(ln["coords"][len(ln["coords"]) // 2][0], ln["coords"][len(ln["coords"]) // 2][1],
                f"{ln['label']} · {ln['since']}") for ln in lns if ln.get("label")]
    place_labels(fig, ax, labels)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
