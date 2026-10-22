"""Step line: a value that changes at dates, as steps (a price cap, a rate), with a curve for context.

Data file (JSON): steps [{date, value}] from the first date; end (the last date drawn); optional
curve [{date, value}] as a grey line for context. Dates are ISO. The axis starts at zero.
The value of each step is written at its start.
"""
from datetime import date

import style as st


def day(s):
    return date.fromisoformat(s)


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    steps = sorted(d["steps"], key=lambda s: s["date"])
    if len(steps) < 2:
        raise st.StyleError("a step line needs two steps")
    end = day(d["end"])
    if end <= day(steps[-1]["date"]):
        raise st.StyleError("the end date must come after the last step")
    curve = sorted(d.get("curve", []), key=lambda s: s["date"])
    top = max(s["value"] for s in steps + curve)
    fig = st.new_fig(st.size_height(meta, 70))
    ax = fig.add_subplot()
    st.style_axes(ax, meta.get("unit", ""))
    if curve:
        ax.plot([day(c["date"]) for c in curve], [c["value"] for c in curve], color=st.CONTEXT, linewidth=st.LINE_W)
    xs = [day(s["date"]) for s in steps] + [end]
    ax.step(xs, [s["value"] for s in steps] + [steps[-1]["value"]], where="post", color=st.INK, linewidth=1.8)
    for s in steps:
        ax.annotate(st.num(s["value"]), (day(s["date"]), s["value"]), xytext=(3, 4), textcoords="offset points",
                    fontsize=st.TEXT_PT, color=st.INK)
    ax.plot([day(s["date"]) for s in steps], [s["value"] for s in steps], "o", color=st.INK, markersize=st.MARKER)
    ax.set_ylim(0, top * 1.15)
    ax.set_xlim(min(xs[0], day(curve[0]["date"]) if curve else xs[0]), end)
    return st.save(fig, out_dir, meta["stem"], meta, grey)
