"""Make a figure from a data file with one command.

    python tools/figures/figures.py KIND DATA [--caption CAPTION.json] [--out DIR] [--grey]
    python tools/figures/figures.py all MANIFEST.json

KIND is line, bars, dumbbell, stacked, table, badge, inference, chain or plate. The caption
file defaults to the data file with the suffix .caption.json. A manifest is a list of
{kind, data, caption?, out?} with paths relative to the manifest.
"""
import argparse
import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import style as st  # noqa: E402

KINDS = ("line", "bars", "dumbbell", "stacked", "table", "badge", "inference", "chain", "plate")
NEEDS_CAPTION = ("line", "bars", "dumbbell", "stacked", "table", "chain", "plate")


def make(kind, data, caption=None, out="figures-out", grey=False):
    if kind not in KINDS:
        raise st.StyleError(f"unknown kind: {kind}")
    data = Path(data)
    cap = Path(caption) if caption else data.with_suffix(".caption.json")
    meta = st.read_json(cap) if cap.exists() else {}
    if kind in NEEDS_CAPTION and not meta:
        raise st.StyleError(f"no caption file: {cap}")
    meta.setdefault("stem", data.stem)
    return importlib.import_module(kind).build(data, meta, out, grey)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("kind")
    p.add_argument("data")
    p.add_argument("--caption")
    p.add_argument("--out", default="figures-out")
    p.add_argument("--grey", action="store_true", help="also write a grey PNG to check the figure")
    a = p.parse_args(argv)
    try:
        if a.kind == "all":
            base = Path(a.data).parent
            for item in st.read_json(a.data):
                cap = base / item["caption"] if item.get("caption") else None
                print(*make(item["kind"], base / item["data"], cap, base / item.get("out", a.out), a.grey),
                      sep="\n")
        else:
            print(*make(a.kind, a.data, a.caption, a.out, a.grey), sep="\n")
    except st.StyleError as e:
        print(f"style error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
