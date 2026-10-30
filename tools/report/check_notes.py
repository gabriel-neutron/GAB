"""List each footnote of the report that breaks the citation norm. It exits 1 when it finds a break.

    python tools/report/check_notes.py FILE.md [FILE.md ...] [--final]

A footnote is `[^label]: text` on one line, with a call `[^label]` in the text of the same file.
The rules follow the citation norm of the report; the checker only reads the text and needs no
database.

Rules: no-note (a call with no note), unused-note (a note with no call), no-source (an empty note),
sources (more than two sources, separated by a semicolon), internal (an identifier, file name or
archive word), relative (a note that points to another place), date (a date that is not full),
version (a list version that differs from the most common one; the first one seen wins a tie), open-marker (`--final` only).
"""
import argparse
import re
import sys
from collections import Counter, namedtuple
from pathlib import Path

Fault = namedtuple("Fault", "file label line rule detail")

MONTH = "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre"
DAY = rf"(?:\d{{1,2}}|1er)(?: (?:{MONTH}))? ?(?:[–-]|et)? ?"
MARKERS = ("[SOURCE ?]", "[année ?]")
MAX_SOURCES = 2
DEFINITION = re.compile(r"^\[\^([^\]]+)\]:\s*(.*)$")
CALL = re.compile(r"\[\^([^\]]+)\](?!:)")
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
INTERNAL = re.compile(rf"{UUID}|\bdoc_\w+|(?<![/.])\b[\w-]+\.(?:xlsx?|csv|md|json|pdf|docx|html|png)\b"
                      r"|\bnon archiv\w*|\barchivé\w*|\bstocké\w*", re.I)
RELATIVE = re.compile(r"\b(?:idem|ibid\w*|op\. cit|même cas|voir (?:l['’]|la |le )?(?:introduction|partie|note)"
                      r"|sources? en partie)", re.I)
SENTENCE_END = re.compile(r"(?<!\bal)(?<=[a-zà-ÿ0-9)\]»_])\.\s+(?=[A-ZÉÀ«*])")
VERSION = rf"[^;]*?version du (\d{{1,2}}(?:er)? (?:{MONTH}) \d{{4}})"
LISTS = {"sdn": re.compile(rf"(?:Specially Designated Nationals|\bSDN\b){VERSION}"),
         "uk": re.compile(rf"UK Sanctions List{VERSION}")}
ACT = re.compile(r"^(?:Règlement|Directive|Décision)", re.I)


def mask(text):
    """Blank the text inside « » and ( ), so a semicolon or a date in a title or an aside is not read."""
    out, depth, quote = [], 0, False
    for ch in text:
        if ch == "«":
            quote = True
        elif ch == "(":
            depth += 1
        keep = not quote and depth == 0
        out.append(ch if keep or ch in "«»()" else "_")
        if ch == "»":
            quote = False
        elif ch == ")":
            depth = max(depth - 1, 0)
    return "".join(out)


def sources_of(body):
    """The source segments of a note: the text up to the first sentence end, cut at the semicolons."""
    masked = mask(body)
    end = SENTENCE_END.search(masked)
    end = end.start() if end else len(body)
    parts, start = [], 0
    for m in re.finditer(";", masked[:end]):
        parts.append(body[start:m.start()])
        start = m.end()
    parts.append(body[start:end])
    return [p.strip() for p in parts if p.strip()]


def date_fault(segment):
    masked = mask(segment)
    has_quote = "«" in masked
    for m in re.finditer(rf"(début |fin |mi-)?({MONTH}) (\d{{4}})", masked):
        if m.group(1):
            return f"« {m.group(0)} » is not a full date"
        if has_quote and not re.search(rf"{DAY}$", masked[:m.start(2)]):
            return f"« {m.group(0)} » has no day"
    if has_quote and not ACT.match(segment) and not re.search(MONTH, masked) and re.search(r"\b(?:19|20)\d{2}\b", masked):
        return "the date is a year only"
    return None


def count_markers(text):
    return {m: text.count(m) for m in MARKERS}


def check_file(name, text):
    notes, calls = {}, {}
    for n, line in enumerate(text.replace(" ", " ").replace(" ", " ").splitlines(), 1):
        if d := DEFINITION.match(line):
            notes[d[1]] = (n, d[2].strip())
        else:
            for c in CALL.finditer(line):
                calls.setdefault(c[1], n)
    faults = []

    def add(label, line, rule, detail):
        faults.append(Fault(name, label, line, rule, detail))

    for label, n in calls.items():
        if label not in notes:
            add(label, n, "no-note", "the call has no note")
    versions = []
    for label, (n, body) in notes.items():
        if label not in calls:
            add(label, n, "unused-note", "no call in the text")
        if not body or body in MARKERS:
            add(label, n, "no-source", "the note has no source")
            continue
        if body.count("«") != body.count("»") or body.count("(") != body.count(")"):
            add(label, n, "unbalanced", "a quote or a parenthesis is not closed")
        segments = sources_of(body)
        if len(segments) > MAX_SOURCES:
            add(label, n, "sources", f"{len(segments)} sources, at most {MAX_SOURCES}")
        if m := INTERNAL.search(body):
            add(label, n, "internal", f"« {m.group(0)} » is not for a reader")
        if m := RELATIVE.search(body):
            add(label, n, "relative", f"« {m.group(0)} » points elsewhere")
        for seg in segments:
            if d := date_fault(seg):
                add(label, n, "date", d)
            for key, pat in LISTS.items():
                if v := pat.search(seg):
                    versions.append((key, v[1], label, n))
    return faults, versions


def check(texts, final=False):
    """Check {file name: text}. The version of a list must be the same in all files."""
    faults, versions = [], []
    for name, text in texts.items():
        f, v = check_file(name, text)
        faults += f
        versions += [(name, *x) for x in v]
        if final and any(count_markers(text).values()):
            faults.append(Fault(name, "-", 0, "open-marker", ", ".join(f"{k} {n}" for k, n in count_markers(text).items() if n)))
    for key in LISTS:
        seen = [x for x in versions if x[1] == key]
        if seen:
            common = Counter(x[2] for x in seen).most_common(1)[0][0]
            faults += [Fault(name, label, n, "version", f"{v}, the other notes say {common}")
                       for name, _, v, label, n in seen if v != common]
    return faults


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("files", nargs="+", type=Path)
    p.add_argument("--final", action="store_true", help="an open marker is a fault")
    a = p.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")
    texts = {f.name: f.read_text(encoding="utf-8") for f in a.files}
    faults = check(texts, a.final)
    for name, text in texts.items():
        mine = [f for f in faults if f.file == name]
        marks = " ".join(f"{k} {n}" for k, n in count_markers(text).items() if n)
        print(f"{name}: {len(mine)} faults" + (f" | {marks}" if marks else ""))
        for f in mine:
            print(f"  {f.label} l.{f.line} {f.rule}: {f.detail}")
    return 1 if faults else 0


if __name__ == "__main__":
    sys.exit(main())
