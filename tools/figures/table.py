"""Table renderer: any CSV to an HTML table in the table style of the site, caption above.

Numbers and ISO dates are mono; numbers align right; an empty cell shows a dash.
"""
import csv
import html
import re

import style as st

MONO_STACK = ", ".join(f'"{f}"' for f in st.MONO) + ", monospace"
CSS = f"""<style>
table.report {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
table.report th {{ font-size: 11px; text-transform: uppercase; letter-spacing: .06em; text-align: left;
  color: {st.LABEL}; border-bottom: 1px solid {st.AXIS}; padding: 4px 8px; }}
table.report td {{ border-bottom: 1px solid {st.AXIS}; padding: 4px 8px; }}
table.report .mono {{ font-family: {MONO_STACK}; }}
table.report .num {{ text-align: right; }}
@media screen {{ table.report tbody tr:nth-child(even) {{ background: {st.BAND}; }} }}
</style>
"""
NUMBER = re.compile(r"^-?[\d,]+(\.\d+)?$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DASH = "–"


def build(data, meta, out_dir, grey=False):
    with open(data, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    head, body = rows[0], rows[1:]
    if not body:
        raise st.StyleError("the table has no row")
    e = html.escape
    numeric = [any(r[i] for r in body) and all(NUMBER.match(r[i]) for r in body if r[i])
               for i in range(len(head))]
    out = [CSS, st.caption_html(meta, "Table"), '<table class="report">\n<thead><tr>']
    out += [f'<th class="{"num" if numeric[i] else ""}">{e(h)}</th>' for i, h in enumerate(head)]
    out.append("</tr></thead>\n<tbody>")
    for r in body:
        out.append("<tr>")
        for i, c in enumerate(r):
            cls = ("num mono" if numeric[i] else "") + (" mono" if DATE.match(c) else "")
            out.append(f'<td class="{cls.strip()}">{e(c) if c else DASH}</td>')
        out.append("</tr>")
    out.append("</tbody></table>\n")
    path = st.Path(out_dir) / f"{meta['stem']}.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out), encoding="utf-8")
    return [path]
