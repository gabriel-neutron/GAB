"""Heat grid: rows against columns, one level in each cell, on one hue in six steps at most.

Data file (JSON): rows [names], cols [names], cells [[level or null]], levels [names of the levels,
low to high; two to six]. Each cell writes its level number as the second mark, so the grid reads in
grey print. A null cell is hatched: no data. The levels are listed under the grid.
"""
import style as st

# One hue (230), light to dark; chroma stays under the grey limit of the style.
STEPS = [st.oklch(f"oklch({v} 0.02 230)") for v in (0.95, 0.825, 0.70, 0.575, 0.45, 0.325)]


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    rows, cols, cells, levels = d["rows"], d["cols"], d["cells"], d["levels"]
    if not 2 <= len(levels) <= len(STEPS):
        raise st.StyleError(f"the grid takes two to {len(STEPS)} levels")
    if len(cells) != len(rows) or any(len(r) != len(cols) for r in cells):
        raise st.StyleError("the cells do not fit the rows and the columns")
    if any(c is not None and not 0 <= c < len(levels) for r in cells for c in r):
        raise st.StyleError("a cell holds a level that does not exist")
    fig = st.new_fig(st.size_height(meta, 30 + 9 * len(rows)))
    ax = fig.add_subplot()
    ax.set_xlim(0, len(cols))
    ax.set_ylim(len(rows), 0)
    ax.xaxis.tick_top()
    ax.set_xticks([j + 0.5 for j in range(len(cols))], cols)
    ax.set_yticks([i + 0.5 for i in range(len(rows))], rows)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.tick_params(length=0)
    for i, r in enumerate(cells):
        for j, c in enumerate(r):
            if c is None:
                ax.fill_between([j, j + 1], i, i + 1, facecolor=st.WHITE, edgecolor=st.AXIS, hatch="///", linewidth=0)
                continue
            ax.fill_between([j, j + 1], i, i + 1, facecolor=STEPS[c], edgecolor=st.WHITE, linewidth=1.5)
            ax.text(j + 0.5, i + 0.5, str(c), ha="center", va="center", fontsize=st.TEXT_PT,
                    color=st.WHITE if c >= 4 else st.INK)
    ax.set_xlabel("   ".join(f"{k} = {n}" for k, n in enumerate(levels)), fontsize=st.NOTE_PT, color=st.LABEL,
                  loc="left")
    return st.save(fig, out_dir, meta["stem"], meta, grey)
