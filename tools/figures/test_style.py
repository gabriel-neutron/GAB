"""Tests of the style rules of the figure tool."""
import pytest

import style as st
from badge import words
from inference import PHIA, label

GREY = st.Mark("g", st.INK, marker="o")


def test_oklch_white_and_black():
    assert st.oklch("oklch(1 0 0)") == "#ffffff"
    assert st.oklch("oklch(0 0 0)") == "#000000"


def test_two_series_cannot_share_a_grey_level():
    same = [st.Mark("a", st.INK, marker="o"), st.Mark("b", st.oklch("oklch(0.25 0.01 230)"), marker="s")]
    with pytest.raises(st.StyleError, match="share a grey level"):
        st.check_marks(same)


def test_a_hue_needs_a_second_mark():
    bare = st.Mark("blue", st.REGIMES["EU"].color)
    with pytest.raises(st.StyleError, match="no second mark"):
        st.check_marks([GREY, bare])


def test_same_grey_and_same_second_mark_is_refused_for_a_hue():
    twin = st.Mark("twin", st.oklch("oklch(0.42 0.11 255)"), hatch="///")
    with pytest.raises(st.StyleError):
        st.check_marks([st.REGIMES["UK"], st.Mark("uk2", st.REGIMES["UK"].color, hatch="///"), twin])


def test_the_regime_scale_and_the_series_pass():
    st.check_marks(list(st.REGIMES.values()))
    st.check_marks(st.SERIES)


def test_the_stacked_greys_stay_apart():
    st.check_marks([st.Mark(str(i), c, label="x") for i, c in enumerate(st.GREY_STEPS)])


def test_every_regime_has_a_distinct_second_mark():
    marks = [(m.hatch, m.marker) for m in st.REGIMES.values()]
    assert len(set(marks)) == len(marks)


def test_caption_needs_number_title_source_note():
    with pytest.raises(st.StyleError, match="note"):
        st.caption_html({"number": 1, "title": "t", "source": "s"})
    out = st.caption_html({"number": 3, "title": "T", "unit": "USD bn", "source": "S.", "note": "N.",
                           "address": "example.org/r/f3"})
    assert "Figure 3. T (USD bn)." in out and "View in the dataset" in out


def test_a_value_without_doc_id_is_refused(tmp_path):
    f = tmp_path / "d.csv"
    f.write_text("serie,periode,valeur,unite,document\na,2020,1,x,\n", encoding="utf-8")
    with pytest.raises(st.StyleError, match="doc_"):
        st.read_data(f)


def test_badge_words_and_refusal():
    assert words("B2") == "source usually reliable, information probably true"
    with pytest.raises(st.StyleError):
        words("G9")


def test_phia_scale_is_complete_and_label_checked():
    assert len(PHIA) == 7
    assert label("likely or probably", "moderate").startswith("Assessment")
    with pytest.raises(st.StyleError):
        label("certain", "high")


def test_a_narrow_figure_wraps_legend_and_labels():
    assert st.legend_cols(["a", "b", "c"]) == 3
    assert st.legend_cols(["a", "b", "c", "d", "e"], 4) == 4  # a full-width figure keeps its fixed columns
    assert st.fit_label("UE après OFAC, autre date OFAC") == "UE après OFAC, autre date OFAC"
    st._width["mm"] = st.PAIR_WIDTH_MM
    try:
        assert st.scale() > 1.5
        assert st.legend_cols(["Combustibles minéraux", "Autres biens"]) == 1
        assert st.legend_cols(["UE-27", "Chine", "Inde", "Autres"]) == 2
        assert "\n" in st.fit_label("UE après OFAC, autre date OFAC")
        assert st.label_room(10) == pytest.approx(0.015 * st.scale() * 10 + 0.02)
    finally:
        st._width["mm"] = st.WIDTH_MM
