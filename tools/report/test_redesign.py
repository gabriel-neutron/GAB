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
    # the contents carry one line on the badges, no legend block
    assert 'class="badge-legend"' not in html and html.count('class="badge-line"') == 1
    assert [i for i, p in enumerate(pages) if "Badges de confiance" in p] == [1]


def test_contents_follow_the_cover_and_the_key_figures_page_follows_the_contents(tmp_path):
    pages, _ = build(tmp_path)
    assert page_of(pages, "Sommaire") == 1
    assert page_of(pages, "Figure 1.") == 2 and page_of(pages, "Chiffres clés") in (1, 2)
    assert page_of(pages, "Le port de Brumel reçoit") == 3 and "Introduction" not in pages[2]
    # the contents list a page number for each section
    toc = pages[1]
    assert re.search(r"Annexe B\.[^\d]*\d+ ", toc)


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
    wide = "![a](figures/plate-a.svg)\n\n![a](figures/plate-a.svg)\n\n**Figure 9.** Deux vues larges. Source : [@port].\n\nUn dernier mot du texte.\n\n"
    text = (SAMPLE / "redesign.md").read_text(encoding="utf-8").replace("## 2.", wide + "## 2.", 1)
    _, html = build(tmp_path, text)
    assert html.count('class="fig panels"') == 1  # the narrow pair of the sample only
    assert f"--w:{report.PAGE_MM:.1f}mm" in html


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

Fin du texte.

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


def test_a_caption_keeps_the_title_and_the_mark_and_drops_the_source_line(tmp_path):
    text = sample("mètres carrés). Source : [@port].", "mètres carrés). Source : Port, 2026[^c]. Note : axe tronqué.").replace(
        "Le registre ne couvre qu'un port.", "Le registre ne couvre qu'un port.\n\n[^c]: Autorité portuaire, 2026.")
    pages, html = build(tmp_path, text)
    caption = re.search(r'<p class="caption"><strong>Figure <span class="fnum">2\.</span>.*?</p>', html, re.S)[0]
    assert "Source" not in caption and "Port, 2026" not in caption
    assert "tonnes" in caption and "mètres carrés" in caption and "axe tronqué" in caption
    assert '<sup class="refs"><a class="ref" href="#ref-1">1</a></sup>' in re.search(r'<p class="caption"><strong>Figure <span class="fnum">1\.</span>.*?</p>', html, re.S)[0]


def test_figure_and_table_numbers_must_rise_in_order_of_appearance(tmp_path):
    with pytest.raises(report.ReportError, match="Figure 1 comes after Figure 2"):
        build(tmp_path, sample("Tableau 1.", "![a](figures/plate-a.svg)\n\n**Figure 1.** Trop tard.\n\nTableau 1."))


def test_a_section_must_not_start_with_a_figure(tmp_path):
    text = sample("## 2. Limites\n\n", "## 2. Limites\n\n![a](figures/plate-a.svg)\n\n**Figure 3.** Trop tôt.\n\n")
    with pytest.raises(report.ReportError, match="starts with a figure"):
        build(tmp_path, text)


def test_a_long_title_and_a_figure_no_text_calls_get_a_warning(tmp_path, capsys):
    build(tmp_path, sample("Deux vues du même quai sur les mêmes axes (tonnes ; mètres carrés)",
                           "Deux vues du même quai sur les mêmes axes de mesure du port (tonnes)"))
    err = capsys.readouterr().err
    assert "figure 2 has 13 words" in err.replace("the title of ", "")
    assert "figure 2 is not called" in err
    build(tmp_path, sample("La cause reste ouverte.", "La cause reste ouverte (figure 2)."))
    assert "figure 2 is not called" not in capsys.readouterr().err


def test_a_side_by_side_pair_has_one_height(tmp_path):
    _, html = build(tmp_path)
    widths = [float(w) for w in re.findall(r'--w:([\d.]+)mm', re.search(r'<figure class="fig panels"[^>]*>.*?</figure>', html, re.S)[0])]
    aspects = [report.aspect_of(SAMPLE / "figures" / n) for n in ("plate-c", "plate-b")]
    assert len(widths) == 2 and widths[0] / aspects[0] == pytest.approx(widths[1] / aspects[1], abs=0.2)
    assert sum(widths) + report.GUTTER_MM <= report.PAGE_MM


def test_the_text_block_is_at_least_265_mm_high(tmp_path):
    from weasyprint import HTML
    build(tmp_path)
    assert HTML(tmp_path / "out" / "r.html").render().pages[1]._page_box.height * 25.4 / 96 >= 265


def test_the_cover_holds_the_title_the_subtitle_and_the_byline_and_no_draft_flag(tmp_path):
    _, html = build(tmp_path, draft=True)
    cover = html.split("</header>")[0]
    assert "Brouillon" not in cover and "draft-flag" not in cover
    assert "Rapport d’essai" in cover and "Auteur Un" in cover


def test_a_figure_that_opens_a_page_after_a_big_blank_waits_for_the_next_paragraph(tmp_path):
    (tmp_path / "figs").mkdir()
    (tmp_path / "figs" / "tall.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" width="400pt" height="620pt" viewBox="0 0 400 620"><rect width="400" height="620" fill="#999"/></svg>', encoding="utf-8")
    filler = "\n\n".join(f"Paragraphe de remplissage {i} " + "mot " * 60 for i in range(6))
    text = (f"---\ntitle: T\nlayout: redesign\n---\n\n## 1. Section\n\n{filler}\n\nAvant la figure 1.\n\n![tall](figures/tall.svg)\n\n"
            "Figure 1. Une figure haute.\n\nSUITE après la figure.\n\nFIN du texte.\n")
    src = tmp_path / "in.md"
    src.write_text(text, encoding="utf-8")
    report.build(src, tmp_path / "figs", tmp_path / "out", name="r")
    pages = [" ".join(p.extract_text().split()) for p in PdfReader(tmp_path / "out" / "r.pdf").pages]
    assert page_of(pages, "SUITE après") == page_of(pages, "Avant la figure") < page_of(pages, "Figure 1.")


def test_delayed_moves_a_figure_after_the_next_paragraphs_and_stops_at_a_heading():
    html = '<p>a</p><figure class="fig"><p class="caption">c</p></figure><p>b</p><p>c</p><h2>x</h2><p>d</p>'
    assert report.delayed(html, {0: 1}) == '<p>a</p><p>b</p><figure class="fig"><p class="caption">c</p></figure><p>c</p><h2>x</h2><p>d</p>'
    # the figure never ends its section: it stops before the last paragraph
    assert report.delayed(html, {0: 3}) == '<p>a</p><p>b</p><figure class="fig"><p class="caption">c</p></figure><p>c</p><h2>x</h2><p>d</p>'
    lst = '<p>a</p><figure class="fig">1</figure><ol><li>x</li></ol><p>b</p>'
    assert report.delayed(lst, {0: 1}) == '<p>a</p><ol><li>x</li></ol><figure class="fig">1</figure><p>b</p>'
    # nor does it land before another figure
    two = '<p>a</p><figure class="fig">1</figure><p>b</p><figure class="fig">2</figure><p>c</p>'
    assert report.delayed(two, {0: 2}) == two


def test_a_pair_of_81_mm_figures_stands_side_by_side_in_the_166_mm_block(tmp_path):
    assert report.PAGE_MM == 166
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="{w}pt" height="{h}pt" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="#999"/></svg>'
    mm = 72 / 25.4
    (tmp_path / "figs").mkdir()
    for n in "ab":
        (tmp_path / "figs" / f"p{n}.svg").write_text(svg.format(w=81 * mm, h=80 * mm), encoding="utf-8")
    text = ("---\ntitle: T\nlayout: redesign\n---\n\n## 1. Section\n\nTexte de la figure 1.\n\n![a](figures/pa.svg)\n\n![b](figures/pb.svg)\n\n"
            "Figure 1. Une paire.\n\nFin.\n")
    src = tmp_path / "in.md"
    src.write_text(text, encoding="utf-8")
    report.build(src, tmp_path / "figs", tmp_path / "out", name="r")
    html = (tmp_path / "out" / "r.html").read_text(encoding="utf-8")
    assert 'class="fig panels"' in html and html.count("--w:81.0mm") == 2


def test_a_section_must_not_end_with_a_figure_or_a_table(tmp_path):
    text = sample("## 2. Limites\n\nLe registre ne couvre qu'un port.", "## 2. Limites\n\nLe registre ne couvre qu'un port.\n\n![a](figures/plate-a.svg)\n\n**Figure 3.** Trop tard.")
    with pytest.raises(report.ReportError, match=r"section 'Limites' ends with a figure"):
        build(tmp_path, text)
    text = sample("## 2. Limites\n\nLe registre ne couvre qu'un port.", "## 2. Limites\n\nLe registre ne couvre qu'un port.\n\nTableau 2. Fin.\n\n| A |\n|---|\n| 1 |")
    with pytest.raises(report.ReportError, match=r"section 'Limites' ends with a figure"):
        build(tmp_path, text)


def test_two_figures_with_few_lines_of_text_between_them_get_a_warning(tmp_path, capsys):
    build(tmp_path)
    assert "two figures or tables are 0 lines" in capsys.readouterr().err  # Figure 2 and Tableau 1 touch
    far = sample("Tableau 1. Les instruments", "Un long texte. " * 40 + "\n\nTableau 1. Les instruments")
    build(tmp_path, far)
    assert "lines of text apart" not in capsys.readouterr().err


def test_the_page_number_is_at_the_bottom_right_and_the_header_is_wider_than_the_text(tmp_path):
    from weasyprint import HTML
    build(tmp_path)
    page = HTML(tmp_path / "out" / "r.html").render().pages[2]._page_box
    mm = 25.4 / 96
    boxes = {type(b).__name__: b for b in page.children}
    assert page.border_width() * mm == pytest.approx(186, abs=0.5) and page.width * mm == pytest.approx(166, abs=0.5)
    top = [b for b in page.children if getattr(b, "at_keyword", "") in ("@top-left", "@top-right")]
    assert top and min(b.position_x for b in top) * mm == pytest.approx(12, abs=0.5)
    right = next(b for b in page.children if getattr(b, "at_keyword", "") == "@bottom-right")
    assert (right.position_x + right.margin_width()) * mm == pytest.approx(210 - 12, abs=0.5)  # the right edge of the header


def test_an_image_with_no_caption_stops_the_build_and_not_the_placement_check():
    with pytest.raises(report.ReportError, match="ends with a figure"):
        report.check_placement("X", ["Du texte.", "![a](f.svg)"])
    assert report.placement(["![a](f.svg)"]) == [("fig", 0)]


def test_the_cover_has_the_title_the_subtitle_and_the_author_only(tmp_path):
    _, html = build(tmp_path, draft=True)
    cover = html.split("</header>")[0]
    assert 'class="author">Auteur Un, Auteure Deux<' in cover and "Rapport d’essai" in cover
    assert "Version de travail" not in cover and "1er janvier 2027" not in cover and "FNF" not in cover


def test_the_contents_page_has_a_line_per_part_a_figure_list_and_fits_one_page(tmp_path):
    pages, html = build(tmp_path)
    toc = html.split('<nav class="toc">')[1].split("</nav>")[0]
    assert toc.count("<li><a href=\"#s") >= 4 and 'class="lof"' in toc and 'href="#fig-2"' in toc
    assert page_of(pages, "Liste des figures") == page_of(pages, "Sommaire") == 1
    assert "Introduction" not in pages[2]


def test_a_section_never_starts_in_the_last_third_of_a_page(tmp_path):
    from weasyprint import HTML
    css = (Path(report.__file__).parent / "report.css").read_text(encoding="utf-8")
    para = "<p>" + "mot " * 60 + "</p>"
    for n in range(8, 30):
        page_html = (f'<style>{css}</style><section id="s0" class=""><h2>Un</h2>{para * n}</section>'
                     f'<section id="s1" class=""><h2>Deux</h2>{para * 2}</section>')
        if report.low_starts(HTML(string=page_html).render()):
            break
    else:
        pytest.fail("no filler length puts the second heading low on the page")
    fixed = report.reflow(page_html, str(tmp_path))
    assert report.low_starts(fixed) == []



def test_the_conclusion_section_is_kept_on_one_page(tmp_path):
    _, html = build(tmp_path, "---\ntitle: T\nlayout: redesign\n---\n\n## 1. Introduction\n\nTexte.\n\n## 2. Conclusion\n\nFin.\n")
    assert '<section id="s1" class="conclusion">' in html


def test_a_note_far_from_its_call_gets_a_warning_and_a_short_set_of_notes_does_not(tmp_path, capsys):
    def doc(n, size):
        paras = "\n\n".join(f"Un paragraphe de texte {i}. " + "mot " * 40 + f"[^n{i}]" for i in range(n))
        notes = "\n".join(f"[^n{i}]: " + "Source très longue " * size for i in range(n))
        return f"---\ntitle: T\nlayout: redesign\n---\n\n## 1. Section\n\n{paras}\n\nFin.\n\n{notes}\n"
    build(tmp_path, doc(4, 3))
    assert "pages after its call" not in capsys.readouterr().err
    build(tmp_path, doc(40, 25))
    assert "pages after its call" in capsys.readouterr().err


def figures_and_text(page_html):
    """The first side figure of a render as (x, top, bottom), and (right edge, top) of every text run of the paragraphs."""
    from weasyprint import HTML
    fig, runs = [], []

    def walk(b, in_p=False):
        tag = getattr(b, "element_tag", None)
        if tag == "figure" and "side" in (b.element.get("class") or ""):
            fig.append((b.position_x, b.margin_width(), b.position_y, b.position_y + b.margin_height()))
            return
        if type(b).__name__ == "TextBox" and in_p:
            runs.append((b.position_x + b.width, b.position_y))
        for c in getattr(b, "children", []) or []:
            walk(c, in_p or tag == "p")
    for page in HTML(string=page_html).render().pages:
        walk(page._page_box)
    return fig[0], runs


def side_html(n_paras, image=None, before=1):
    css = (Path(report.__file__).parent / "report.css").read_text(encoding="utf-8")
    para = "<p>" + "mot " * 60 + "</p>"
    fig = '<figure class="fig side"><img src="' + (image or SAMPLE / "figures" / "plate-b.svg").as_uri() + '"><p class="caption">Figure 1. Un titre.</p></figure>'
    return f"<style>{css}</style><section id='s0' class=''>{para * before}{fig}{para * n_paras}</section>"


def test_a_side_figure_floats_right_at_81_mm_and_the_text_goes_on_at_its_left():
    mm = 96 / 25.4
    (x, width, top, bottom), runs = figures_and_text(side_html(4))
    beside = [r for r in runs if top <= r[1] < bottom]
    assert width / mm == pytest.approx(81 + 5, abs=1) and x / mm > 80
    assert beside and all(right <= x for right, _ in beside)


def test_a_floated_figure_that_moves_to_the_next_page_goes_back_into_the_flow(tmp_path):
    from weasyprint import HTML
    tall = tmp_path / "tall.svg"
    tall.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="230pt" height="640pt" viewBox="0 0 230 640"><rect width="230" height="640" fill="#999"/></svg>', encoding="utf-8")
    for n in range(1, 30):
        page_html = side_html(4, tall, before=n)
        if report.pushed_floats(HTML(string=page_html).render()):
            break
    else:
        pytest.fail("no filler length pushes the float to the next page")
    fixed = report.reflow(page_html, str(tmp_path))
    assert report.pushed_floats(fixed) == []
    assert report.unfloated(page_html, {0}).count('class="fig side') == 0


def test_the_theme_file_is_read_after_the_report_css(tmp_path):
    theme = tmp_path / "theme.css"
    theme.write_text(":root{--section:30pt}", encoding="utf-8")
    src = tmp_path / "in.md"
    src.write_text("---\ntitle: T\nlayout: redesign\n---\n\n## 1. A\n\nTexte.\n", encoding="utf-8")
    report.build(src, SAMPLE / "figures", tmp_path / "out", name="r", theme_css=theme)
    assert (tmp_path / "out" / "r.html").read_text(encoding="utf-8").rstrip().count("--section:30pt") == 1


def test_the_heading_levels_differ_in_size_and_a_section_has_a_rule():
    css = (Path(report.__file__).parent / "report.css").read_text(encoding="utf-8")
    size = lambda token: float(re.search(rf"--{token}:\s*([\d.]+)pt", css)[1])
    assert size("section") >= 1.3 * size("body") and size("sub") > size("body")
    assert re.search(r"h2 \{[^}]*border-bottom", css) and not re.search(r"h3 \{[^}]*border-bottom", css)


def test_delayed_moves_a_side_figure_like_a_plain_one_and_unfloated_counts_by_ordinal():
    html = '<p>a</p><figure class="fig side" id="fig-1">1</figure><p>b</p><p>c</p><p>d</p><figure class="fig" id="fig-2">2</figure><p>e</p><p>f</p>'
    assert report.delayed(html, {0: 1}).startswith('<p>a</p><p>b</p><figure class="fig side" id="fig-1">1</figure><p>c</p>')
    assert report.delayed(html, {1: 1}) == html.replace('<figure class="fig" id="fig-2">2</figure><p>e</p>', '<p>e</p><figure class="fig" id="fig-2">2</figure>')
    assert report.is_side('<figure class="fig side" id="fig-1">') and report.is_side("fig side") and not report.is_side('<figure class="fig" id="side-1">')
    assert report.unfloated(html, {0}).count("fig side") == 0 and report.unfloated(html, {1}) == html


def test_a_pushed_side_figure_with_text_beside_it_stays_floated(tmp_path):
    from weasyprint import HTML
    tall = tmp_path / "tall.svg"
    tall.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="230pt" height="640pt" viewBox="0 0 230 640"><rect width="230" height="640" fill="#999"/></svg>', encoding="utf-8")
    for n in range(1, 30):
        pdf = HTML(string=side_html(40, tall, before=n)).render()
        opens = [i for i, page in enumerate(pdf.pages) if i and (b := report.blocks_of_page(page._page_box)[0]) and b[0][0] == "figure"]
        if opens:
            break
    else:
        pytest.fail("no filler length moves the float to a later page")
    assert report.pushed_floats(pdf) == []


def test_a_side_figure_after_plain_figures_goes_back_into_the_flow_by_its_own_ordinal(tmp_path):
    from weasyprint import HTML
    tall = tmp_path / "tall.svg"
    tall.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="230pt" height="640pt" viewBox="0 0 230 640"><rect width="230" height="640" fill="#999"/></svg>', encoding="utf-8")
    plain = '<figure class="fig" id="fig-1"><img src="' + (SAMPLE / "figures" / "plate-b.svg").as_uri() + '"><p class="caption">Figure 1. Plain.</p></figure>'
    for n in range(1, 30):
        page_html = side_html(4, tall, before=n).replace("<figure class=\"fig side\"", plain + '<figure class="fig side"', 1)
        pushed = report.pushed_floats(HTML(string=page_html).render())
        if pushed:
            break
    else:
        pytest.fail("no filler length pushes the float to the next page")
    assert pushed == [1] and report.unfloated(page_html, set(pushed)).count('class="fig side') == 0
    assert report.unfloated(page_html, set(pushed)).count('class="fig"') == 2


def test_a_note_in_a_side_caption_is_on_the_page_of_its_call(tmp_path):
    text = ("---\ntitle: T\nlayout: redesign\n---\n\n## 1. Section\n\nTexte de la figure 1.\n\n![side: Figure 1](figures/plate-b.svg)\n\n"
            "Figure 1. Un titre. Source : Port, 2026[^c].\n\n" + "\n\n".join("Un paragraphe de suite. " + "mot " * 50 for _ in range(4)) + "\n\nFin.\n\n[^c]: Autorité portuaire, 2026.\n")
    pages, html = build(tmp_path, text)
    assert 'class="fig side"' in html
    assert [i for i, p in enumerate(pages) if "Autorité portuaire" in p] == [page_of(pages, "Figure 1.")]



def test_dossier_is_the_default_theme_and_base_drops_it(tmp_path):
    src = tmp_path / "in.md"
    src.write_text("---\ntitle: T\nlayout: redesign\n---\n\n## 1. A\n\n{pull} La thèse.\n\nTexte.\n", encoding="utf-8")
    for theme, has in (("dossier", True), ("base", False)):
        report.build(src, SAMPLE / "figures", tmp_path / theme, name="r", theme=theme)
        page = (tmp_path / theme / "r.html").read_text(encoding="utf-8")
        assert ("--serif:" in page) is has
        assert '<p class="pull">La thèse.</p>' in page
        assert "{pull}" not in page
    assert re.search(r"--dark-background:#[0-9a-f]{6}", page) and "--primary:#006da6" in page


def test_the_note_of_a_caption_has_its_own_span(tmp_path):
    text = ("---\ntitle: T\nlayout: redesign\n---\n\n## 1. A\n\nTexte de la figure 1.\n\n![x](figures/plate-a.svg)\n\n"
            "Figure 1. Un titre court. Source : X. Note : une note.\n\nSuite.\n")
    _, page = build(tmp_path, text)
    assert re.search(r'<span class="note">Note[   ]: une note\.</span></p>', page)
