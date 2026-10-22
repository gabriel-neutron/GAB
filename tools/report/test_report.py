"""The report keeps every footnote, every figure with its caption and every open marker."""
import re
from pathlib import Path

import pytest
from pypdf import PdfReader

import report

SAMPLE = Path(__file__).parent / "sample"
FILLER = ("Le port reçoit des navires de pêche et de charge toute l'année, et chaque escale laisse une trace "
          "dans le registre du quai ; la lecture des lignes demande de la patience et de la méthode.\n\n")


def source(filler_before=0, marker_free=False):
    """The sample, with filler paragraphs before the context section to move the page breaks."""
    text = (SAMPLE / "sample.md").read_text(encoding="utf-8")
    text = text.replace("## 2. Contexte\n\n", "## 2. Contexte\n\n" + FILLER * filler_before)
    if marker_free:
        text = re.sub(report.OPEN_MARKER, "ok", text).replace("**ok.**", "**Écrit.**")
    return text


def build(tmp_path, text, draft=True):
    src = tmp_path / "in.md"
    src.write_text(text, encoding="utf-8")
    report.build(src, SAMPLE / "figures", tmp_path / "out", draft=draft, name="r")
    pages = [" ".join(p.extract_text().split()).replace("\u202f", " ").replace("\u00a0", " ")
             for p in PdfReader(tmp_path / "out" / "r.pdf").pages]
    return pages, (tmp_path / "out" / "r.html").read_text(encoding="utf-8")


def page_of(pages, needle):
    hits = [i for i, t in enumerate(pages) if needle in t]
    assert hits, f"{needle!r} is not in the PDF"
    return hits[0]


def test_every_footnote_sits_at_the_foot_of_the_page_of_its_call(tmp_path):
    pages, html = build(tmp_path, source())
    for body, note in (("la moitié ne dépose", "Registre du port de Brumel"), ("quai nord reste fermé", "Arrêté 2021/9"),
                       ("1 450 en 2025", "Rapport annuel du port")):
        p = page_of(pages, body)
        assert note in pages[p] and pages[p].index(note) > pages[p].index(body)
        assert note in html


def test_a_footnote_with_no_definition_stops_the_build(tmp_path):
    with pytest.raises(report.ReportError, match="no definition"):
        build(tmp_path, source().replace("[^c]: ", "[^z]: "))


@pytest.mark.parametrize("filler", range(0, 36))
def test_no_figure_or_table_caption_is_split_from_its_content(tmp_path, filler):
    pages, _ = build(tmp_path, source(filler))
    for mark, caption in (("MARK-FIG-A", "Figure 1."), ("MARK-FIG-B", "Figure 2.")):
        assert page_of(pages, mark) == page_of(pages, caption)
    assert page_of(pages, "Tableau 1.") == page_of(pages, "Arrêté 2020/1")


def test_every_marker_is_on_the_open_points_page_in_a_draft(tmp_path):
    pages, html = build(tmp_path, source())
    start = page_of(pages, "Points ouverts")
    listed = " ".join(pages[start:])
    for marker in ("[À CONFIRMER: mesure ADMIRALTY]", "[LIEN JEU DE DONNÉES]", "[À STOCKER: série mensuelle des escales]",
                   report.RESERVED):
        assert marker in listed
    assert html.count('class="open"') >= 8
    assert page_of(pages, "Points ouverts") == len(pages) - 1


def test_a_final_build_refuses_an_open_marker_and_has_no_open_page(tmp_path):
    with pytest.raises(report.ReportError, match="open marker"):
        build(tmp_path, source(), draft=False)
    pages, html = build(tmp_path, source(marker_free=True), draft=False)
    assert not any("Points ouverts" in p for p in pages) and 'class="open"' not in html


def test_title_page_funding_byline_and_running_header(tmp_path):
    pages, html = build(tmp_path, source())
    assert "Auteur Un, Auteure Deux" in pages[0] and "version 0.1" in pages[0]
    assert report.FUNDING in pages[1] and report.FUNDING in html
    assert "Rapport d'essai sur un port imaginaire" in pages[2] and "1. Résumé" in pages[2]
    assert "FNF logo" not in html and html.count("<img") == 3


def test_french_typography_and_confidence_marks(tmp_path):
    _, html = build(tmp_path, source())
    assert "\u202f;" in html and "\u00a0:" in html and "1\u202f200" in html and "35,5\u202f%" in html
    for word in report.CONFIDENCE:
        assert f"</span> {word}</span>" in html
