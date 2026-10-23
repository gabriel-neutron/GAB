"""Timeline: events as stems with labels, bands as hatched spans.

Data file (JSON): start, end (ISO dates), events [{date, label, source}], bands [{from, to, label,
source}]. Labels are placed on levels so that no label overlaps another label or a stem. A band narrower than its label gets the label to its right. A band takes a grey and a hatch
in turn, so two bands stay apart in grey print. Nothing is drawn without a source key.
"""
from datetime import date

import style as st

BAND_FILLS = [(st.BAND, ""), (st.AXIS, "///"), (st.BAND, "\\\\\\")]
LEVELS = 4


def day(s):
    return date.fromisoformat(s)


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    events = sorted(d.get("events", []), key=lambda e: e["date"])
    bands = d.get("bands", [])
    st.need_sources(events, "an event")
    st.need_sources(bands, "a band")
    if len(bands) > len(BAND_FILLS) or any(b["from"] > b["to"] for b in bands):
        raise st.StyleError(f"at most {len(BAND_FILLS)} bands, each from an earlier to a later date")
    start, end = day(d["start"]), day(d["end"])
    if any(not start <= day(e["date"]) <= end for e in events):
        raise st.StyleError("an event lies outside the time range")
    # a label is about 1.5 mm a character; it runs right of its stem, or left of it when that is free.
    # A level is free when no label of that level overlaps it and no stem crosses a label of another level.
    span = (end - start).days
    pad = span * 0.01
    widths = [len(e["label"]) * 1.5 / st.WIDTH_MM * span for e in events]
    xs = [(day(e["date"]) - start).days for e in events]

    def box(i, left):  # (stem, left edge, right edge) of the label, right of the stem or left of it
        x, w = xs[i], widths[i]
        return (x, x - w - pad, x + pad) if left else (x, x - pad, x + w + pad)

    def clash(p, q, lvl_p, lvl_q):
        if lvl_p == lvl_q:
            return p[1] < q[2] and q[1] < p[2]
        low, high = (p, q) if lvl_p < lvl_q else (q, p)  # the stem of the higher one crosses the label of the lower one
        return low[1] <= high[0] <= low[2]

    def assign(i, placed):
        if i == len(events):
            return placed
        for k in range(LEVELS):
            for left in (False, True):
                b = box(i, left)
                if not (-pad <= b[1] and b[2] <= span + pad):
                    continue
                if not any(clash(p[0], b, p[1], k) for p in placed):
                    if (got := assign(i + 1, placed + [(b, k, left)])) is not None:
                        return got
        return None

    placed = assign(0, [])
    if placed is None:
        longest = max(events, key=lambda e: len(e["label"]))["label"]
        raise st.StyleError(f"no free level for the labels: shorten a label (the longest is {longest!r}) or drop an event")
    used = [p[1] for p in placed]
    sides = [p[2] for p in placed]
    fig = st.new_fig(st.size_height(meta, 24 + 8 * (max(used, default=0) + 1) + 7 * len(bands)))
    ax = fig.add_subplot()
    ax.set_xlim(start, end)
    top = max([0] + [lv + 1 for lv in used])
    ax.set_ylim(-0.9 - len(bands) * 0.45, top + 0.6)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_position(("data", 0))
    ax.set_yticks([])
    ax.tick_params(axis="x", length=2, width=0.5)
    for e, lvl, left in zip(events, used, sides):
        ax.plot([day(e["date"])] * 2, [0, lvl + 0.55], color=st.SECOND, linewidth=0.7)
        ax.plot(day(e["date"]), 0, "o", color=st.INK, markersize=st.MARKER - 1)
        ax.text(day(e["date"]), lvl + 0.6, e["label"],
                ha="right" if left else "left", va="bottom", fontsize=st.NOTE_PT, color=st.INK)
    for k, b in enumerate(bands):
        fill, hatch = BAND_FILLS[k % len(BAND_FILLS)]
        y = -0.9 - k * 0.45
        ax.fill_between([day(b["from"]), day(b["to"])], y - 0.35, y, facecolor=fill, hatch=hatch,
                        edgecolor=st.SECOND, linewidth=0.5)
        # a band narrower than its label keeps the label beside it, so the hatch stays visible: to its right, or to
        # its left when the right edge is too near
        label_days = (len(b["label"]) + 1) * 1.5 / st.WIDTH_MM * span
        wide = (day(b["to"]) - day(b["from"])).days >= label_days
        left = not wide and (end - day(b["to"])).days < label_days
        ax.text(day(b["from"]) if wide else day(b["to"]) if not left else day(b["from"]), y - 0.17, " " + b["label"] + " " * left,
                ha="right" if left else "left", va="center", fontsize=st.NOTE_PT, color=st.INK, clip_on=True,
                bbox=dict(facecolor=st.WHITE, edgecolor="none", pad=0.8) if wide else None)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
