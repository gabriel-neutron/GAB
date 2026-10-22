"""ADMIRALTY badge: letter and digit in mono, a 1 px box in the input grey, no fill, no hue.

Data file (JSON): {"code": "B2", "record": "<address of the record page>"}.
Output: an SVG and an HTML link with the tooltip of the two words.
"""
import html
import re

import style as st

SOURCE = {"A": "completely reliable", "B": "usually reliable", "C": "fairly reliable",
          "D": "not usually reliable", "E": "unreliable", "F": "reliability cannot be judged"}
INFO = {"1": "confirmed by other sources", "2": "probably true", "3": "possibly true",
        "4": "doubtful", "5": "improbable", "6": "truth cannot be judged"}
MONO_STACK = ", ".join(st.MONO)


def words(code):
    if not re.fullmatch(r"[A-F][1-6]", code or ""):
        raise st.StyleError(f"not an ADMIRALTY pair: {code!r}")
    return f"source {SOURCE[code[0]]}, information {INFO[code[1]]}"


def svg(code):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="26" height="16" viewBox="0 0 26 16">'
            f'<rect x=".5" y=".5" width="25" height="15" fill="none" stroke="{st.INPUT}" stroke-width="1"/>'
            f'<text x="13" y="12" text-anchor="middle" font-family="{MONO_STACK}" font-size="10" '
            f'fill="{st.INK}">{code}</text></svg>\n')


def build(data, meta, out_dir, grey=False):
    d = st.read_json(data)
    tip = words(d["code"])
    out = st.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{meta['stem']}.svg").write_text(svg(d["code"]), encoding="utf-8")
    href = f' href="{html.escape(d["record"])}"' if d.get("record") else ""
    link = (f'<a class="badge"{href} title="{html.escape(tip)}" style="font-family:{MONO_STACK};'
            f'border:1px solid {st.INPUT};padding:0 3px;color:{st.INK};text-decoration:none">{d["code"]}</a>\n')
    (out / f"{meta['stem']}.html").write_text(link, encoding="utf-8")
    return [out / f"{meta['stem']}.svg", out / f"{meta['stem']}.html"]
