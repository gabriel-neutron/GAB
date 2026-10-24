"""Mark of an inference: a block with a 2 px rule at the left and a label line.

Data file (JSON): {"level": "likely or probably", "confidence": "moderate", "text": "..."}.
The words and ranges are the UK PHIA probability yardstick. They apply to the judgments of the
authors only.
"""
import html

import style as st

PHIA = {"remote": "0–5", "highly unlikely": "10–20", "unlikely": "25–35",
        "realistic possibility": "40–50", "likely or probably": "55–75",
        "highly likely": "80–90", "almost certain": "95–100"}
CONFIDENCE = ("high", "moderate", "low")


def label(level, confidence):
    if level not in PHIA or confidence not in CONFIDENCE:
        raise st.StyleError(f"unknown word: {level!r} / {confidence!r}")
    return f"Assessment · {level} ({PHIA[level]}{st.THIN}%) · {confidence} confidence"


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    e = html.escape
    block = (f'<div class="assessment" style="border-left:2px solid {st.INPUT};padding-left:12px">\n'
             f'<p style="font-size:11px;color:{st.LABEL};margin:0">{e(label(d["level"], d["confidence"]))}</p>\n'
             f'<p>{e(d["text"])}</p>\n</div>\n')
    path = st.Path(out_dir) / f"{meta['stem']}.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(block, encoding="utf-8")
    return [path]
