"""The redesign layout: numbered references, bibliography, badge, contents, annexes, funding once.

The sample is synthetic (sample/redesign.md and sample/bibliography.json).
"""
import json
import re
import shutil
from pathlib import Path

import pytest
from pypdf import PdfReader

import report

SAMPLE = Path(__file__).parent / "sample"


def build(tmp_path, text=None, bib=None, draft=True):
    src = tmp_path / "in.md"
    src.write_text(text if text is not None else (SAMPLE / "redesign.md").read_text(encoding="utf-8"), encoding="utf-8")
    shutil.copy(SAMPLE / "bibliography.json", tmp_path / "bibliography.json")
    if bib is not None:
        (tmp_path / "bibliography.json").write_text(json.dumps(bib), encoding="utf-8")
    report.build(src, SAMPLE / "figures", tmp_path / "out", draft=draft, name="r")
    pages = [" ".join(p.extract_text().split()).replace(" ", " ").replace(" ", " ")
             for p in PdfReader(tmp_path / "out" / "r.pdf").pages]
    return pages, (tmp_path / "out" / "r.html").read_text(encoding="utf-8")


def page_of(pages, needle):
    hits = [i for i, t in enumerate(pages) if needle in t]
    assert hits, f"{needle!r} is not in the PDF"
    return hits[0]


def bib():
    return json.loads((SAMPLE / "bibliography.json").read_text(encoding="utf-8"))


def test_references_are_numbered_by_first_use_and_the_bibliography_lists_each_entry(tmp_path):
    pages, html = build(tmp_path)
    # first use: port = 1, then acte (figure caption before it is in the key-figures section: port only)
    assert '[<a class="ref" href="#ref-1">1</a>]' in html
    assert '[<a class="ref" href="#ref-1">1</a>, <a class="ref" href="#ref-2">2</a>]' in html
    entries = re.findall(r'<li id="ref-(\d)">(.*?)</li>', html)
    assert [n for n, _ in entries] == ["1", "2", "3"]
    assert "Autorité portuaire imaginaire" in entries[0][1] and "p. 3" in entries[0][1]
    assert "https://example.org/rapport-2026" in entries[1][1] and "consulté le 2027-01-11" in entries[1][1]
    assert "Bibliographie" in " ".join(pages)


def test_no_document_identifier_prints(tmp_path):
    pages, html = build(tmp_path)
    assert not re.search(r"doc_[0-9a-f]{12}", html + " ".join(pages))


def test_a_document_identifier_in_the_text_stops_the_build(tmp_path):
    text = (SAMPLE / "redesign.md").read_text(encoding="utf-8").replace("Le registre ne couvre", "Voir doc_0123456789ab. Le registre ne couvre")
    with pytest.raises(report.ReportError, match="document identifier"):
        build(tmp_path, text)


def test_an_identifier_in_the_bibliography_stops_the_build(tmp_path):
    entries = bib()
    entries["port"]["title"] = "doc_0123456789ab"
    with pytest.raises(report.ReportError, match="document identifier"):
        build(tmp_path, bib=entries)


def test_an_unknown_key_and_an_incomplete_entry_stop_the_build(tmp_path):
    text = (SAMPLE / "redesign.md").read_text(encoding="utf-8").replace("[@acte].\n\n## Annexe B", "[@absent].\n\n## Annexe B")
    with pytest.raises(report.ReportError, match="absent"):
        build(tmp_path, text)
    entries = bib()
    del entries["acte"]["accessed"]
    with pytest.raises(report.ReportError, match="accessed"):
        build(tmp_path, bib=entries)


def test_in_a_table_the_source_is_a_superscript_number(tmp_path):
    _, html = build(tmp_path)
    table = re.search(r"<table>.*?</table>", html, re.S)[0]
    assert '<sup class="refs"><a class="ref" href="#ref-3">3</a></sup>' in table and "[<a" not in table
    assert re.search(r'<td class="num mono">1.200 ?<sup', table)


def test_badge_has_four_levels_with_a_letter_and_one_legend_after_the_contents(tmp_path):
    pages, html = build(tmp_path)
    in_text = html.split("<main>")[1]
    for level, letter in (("Établi", "E"), ("Probable", "P"), ("Indicatif", "I"), ("Non établi", "N")):
        assert f'<span class="badge" title="{level}"><svg' in in_text and f'<span class="bl">{letter}</span>' in in_text
    # the word is plain text in the redesign: no pips, no small caps
    assert 'class="pips"' not in html
    assert html.count('class="badge-legend"') == 1
    legend = [i for i, p in enumerate(pages) if "lecture du badge" in p.lower()]
    assert legend == [1]


def test_contents_follow_the_cover_and_the_key_figures_page_follows_the_contents(tmp_path):
    pages, _ = build(tmp_path)
    assert page_of(pages, "Sommaire") == 1
    assert page_of(pages, "Figure 1.") == 2 and page_of(pages, "Chiffres clés") in (1, 2)
    assert page_of(pages, "Le port de Brumel reçoit") == 3 and "Introduction" not in pages[2]
    # the contents list a page number for each section
    toc = pages[1]
    assert re.search(r"Annexe B\..*?\.{5,}\s*\d+", toc)


def test_the_bibliography_follows_the_annexes(tmp_path):
    pages, _ = build(tmp_path)
    bibliography = page_of(pages, "consulté le")
    ann_a = [i for i, t in enumerate(pages) if "Un tableau long viendrait ici" in t][0]
    ann_b = [i for i, t in enumerate(pages) if "Une note de méthode longue" in t][0]
    assert ann_a < ann_b < bibliography


def test_the_funding_sentence_prints_once_at_the_end(tmp_path):
    pages, html = build(tmp_path)
    assert html.count(report.FUNDING) == 1
    assert sum(report.FUNDING in p for p in pages) == 1 and report.FUNDING in pages[-2] + pages[-1]


def test_side_by_side_panels_stay_with_their_caption(tmp_path):
    pages, html = build(tmp_path)
    assert 'class="fig panels"' in html
    caption = page_of(pages, "Figure 2.")
    assert page_of(pages, "MARK-FIG-C") == caption == page_of(pages, "MARK-FIG-B")


def test_a_badge_of_an_unknown_level_stops_the_build(tmp_path):
    text = (SAMPLE / "redesign.md").read_text(encoding="utf-8").replace("{{Probable}}", "{{Sûr}}")
    with pytest.raises(report.ReportError, match="unknown badge"):
        build(tmp_path, text)


def test_the_old_layout_is_unchanged_without_the_front_matter_key(tmp_path):
    text = "---\ntitle: T\n---\n\n## 1. A\n\nUn texte [@x] et {{Établi}}.\n"
    pages, html = build(tmp_path, text)
    assert "[@x]" in html and 'class="badge"' not in html and "{{" in html and "Sommaire" not in html and report.FUNDING in html


def sample(old, new):
    return (SAMPLE / "redesign.md").read_text(encoding="utf-8").replace(old, new)


@pytest.mark.parametrize("old,new", [
    ("## 2. Limites", "## 2. Limites [@acte]"),
    ("Le registre ne couvre qu'un port.", "Le registre ne couvre qu'un port [@smith:2020]."),
    ("Le registre ne couvre qu'un port.", "Le registre ne couvre qu'un port {{Établi."),
])
def test_a_mark_that_cannot_resolve_stops_the_build_instead_of_printing_raw(tmp_path, old, new):
    with pytest.raises(report.ReportError, match="not allowed|not valid"):
        build(tmp_path, sample(old, new))


def test_a_code_span_keeps_its_marks_as_text(tmp_path):
    _, html = build(tmp_path, sample("Le registre ne couvre qu'un port.", "Écrire `[@absent]` ou `{{x}}` pour citer."))
    assert "<code>[@absent]</code>" in html and "<code>{{x}}</code>" in html


def test_numbers_follow_the_order_of_print_when_an_annex_comes_first(tmp_path):
    text = sample("## 1. Introduction", "## Annexe C. Premier\n\nUn point [@rapport].\n\n## 1. Introduction")
    _, html = build(tmp_path, text)
    entries = re.findall(r'<li id="ref-(\d)">(.*?)</li>', html)
    assert "Autorité portuaire" in entries[0][1]


def test_a_bad_bibliography_file_stops_the_build_with_a_clear_error(tmp_path):
    for bad in ([], {"port": "text"}, {"a b": bib()["port"]}, {"port": bib()["port"] | {"date": 2027}}):
        with pytest.raises(report.ReportError):
            build(tmp_path, bib=bad)


def test_the_funding_and_a_short_identifier_check(tmp_path):
    with pytest.raises(report.ReportError, match="document identifier"):
        build(tmp_path, sample("Le registre ne couvre", "Voir doc_abc. Le registre ne couvre"))


def test_a_figure_prints_at_its_own_width_and_two_wide_figures_stack(tmp_path):
    wide = "![a](figures/plate-a.svg)\n\n![a](figures/plate-a.svg)\n\n**Figure 9.** Deux vues larges. Source : [@port].\n\n"
    text = (SAMPLE / "redesign.md").read_text(encoding="utf-8").replace("## 2.", wide + "## 2.", 1)
    _, html = build(tmp_path, text)
    assert html.count('class="fig panels"') == 1  # the narrow pair of the sample only
    assert "--w:160.0mm" in html and "--w:78.0mm" in html


def test_natural_mm_reads_pt_then_the_viewbox_in_mm(tmp_path):
    (tmp_path / "pt.svg").write_text('<svg width="453.543307pt" height="10pt" viewBox="0 0 453.5 10">', encoding="utf-8")
    (tmp_path / "mm.svg").write_text('<svg viewBox="0 0 80 134" width="960" height="1608">', encoding="utf-8")
    (tmp_path / "big.svg").write_text('<svg viewBox="0 0 453 170" width="453">', encoding="utf-8")
    assert report.natural_mm(tmp_path / "pt.svg") == pytest.approx(160, abs=0.01)
    assert report.natural_mm(tmp_path / "mm.svg") == 80
    assert report.natural_mm(tmp_path / "big.svg") == report.PAGE_MM
    assert report.natural_mm(tmp_path / "none.svg") == report.PAGE_MM
    (tmp_path / "broken.svg").write_text("not an svg", encoding="utf-8")
    assert report.natural_mm(tmp_path / "broken.svg") == report.PAGE_MM


NO_BIB = """---
title: Essai
subtitle: Notes sans bibliographie
layout: redesign
---

## 1. Texte

Un fait [^a]. Un autre fait [^b].

![Figure 1. Trois chiffres](figures/plate-a.svg)

**Figure 1.** Trois chiffres. Source : Port, 2026[^c].

Tableau 1. Les contrôles. Source : voir les notes.

| Contrôle | Source |
|---|---|
| Quai | [^d] |

[^a]: Port de Brumel, « Rapport annuel », 2026, p. 3, https://example.org/a (consulté le 1er janvier 2027).
[^b]: Port de Brumel, 2026, p. 4.
[^c]: Port de Brumel, 2026.
[^d]: Autorité, 2025.
"""


def test_footnotes_without_a_bibliography_print_at_the_foot_and_no_bibliography_page(tmp_path):
    pages, html = build(tmp_path, NO_BIB)
    assert "Bibliographie" not in html and not any("Bibliographie" in p for p in pages)
    body_end = "Quai"  # the last text of the body: the table row
    for note in ("Rapport annuel", "Port de Brumel, 2026, p. 4", "Port de Brumel, 2026.", "Autorité, 2025"):
        p = page_of(pages, note)
        assert p == page_of(pages, "Un fait"), note  # on the page of its call
        assert pages[p].rfind(note) > pages[p].index(body_end), note  # after the body, at the foot
    assert re.findall(r'id="fnref-(\d+)-1"', html) == ["1", "2", "3", "4"]
    # the PDF counter runs 1 to 4 on the one page
    assert all(f"{n}." in pages[0] + pages[1] + pages[2] for n in (1, 2, 3, 4))
