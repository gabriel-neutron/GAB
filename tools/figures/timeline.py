"""Timeline: events as stems with labels, bands as hatched spans.

Data file (JSON): start, end (ISO dates), events [{date, label, source}], bands [{from, to, label,
source}]. Labels are placed on levels so that they do not overlap. A band takes a grey and a hatch
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
    # a label of this level is free again where the previous one ends: about 1.5 mm a character
    span = (end - start).days
    free, used = [-1] * LEVELS, []
    for e in events:
        x = (day(e["date"]) - start).days
        lvl = next((k for k in range(LEVELS) if free[k] <= x), None)
        if lvl is None:
            raise st.StyleError(f"no free level for the label: {e['label']}")
        free[lvl] = x + len(e["label"]) * 1.5 / st.WIDTH_MM * span + span * 0.01
        used.append(lvl)
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
    for e, lvl in zip(events, used):
        ax.plot([day(e["date"])] * 2, [0, lvl + 0.55], color=st.SECOND, linewidth=0.7)
        ax.plot(day(e["date"]), 0, "o", color=st.INK, markersize=st.MARKER - 1)
        ax.text(day(e["date"]), lvl + 0.6, e["label"],
                ha="right" if (day(e["date"]) - start).days > 0.85 * span else "left", va="bottom", fontsize=st.NOTE_PT, color=st.INK)
    for k, b in enumerate(bands):
        fill, hatch = BAND_FILLS[k % len(BAND_FILLS)]
        y = -0.9 - k * 0.45
        ax.fill_between([day(b["from"]), day(b["to"])], y - 0.35, y, facecolor=fill, hatch=hatch,
                        edgecolor=st.SECOND, linewidth=0.5)
        ax.text(day(b["from"]), y - 0.17, " " + b["label"], ha="left", va="center", fontsize=st.NOTE_PT,
                color=st.INK, clip_on=True, bbox=dict(facecolor=st.WHITE, edgecolor="none", pad=0.8))
    return st.save(fig, out_dir, meta["stem"], meta, grey)
