"""Tests of the dot plot, spread, panel, locale, label and data-check rules. Data is synthetic."""
import json

import pytest

import figures
import style as st

CAPTION = {"number": 9, "title": "Synthetic", "unit": "unit", "source": "Synthetic.", "note": "Synthetic."}
DOC = "doc_0123456789ab"


def csv_rows(*lines, doc=DOC, extra=""):
    """Each line is 'serie,periode,valeur[,unite][,panel]'."""
    head = "serie,periode,valeur,unite,document,page,extrait_ou_cellule,note" + (",panel" if extra else "") + "\n"
    out = []
    for x in lines:
        parts = x.split(",")
        unit = parts[3] if len(parts) > 3 else "u"
        panel = f",{parts[4]}" if extra else ""
        out.append(f"{parts[0]},{parts[1]},{parts[2]},{unit},{doc},1,x,{panel}\n")
    return head + "".join(out)


def make(tmp_path, kind, text, cap=None, **kw):
    d = tmp_path / "d.csv"
    d.write_text(text, encoding="utf-8")
    (tmp_path / "d.caption.json").write_text(json.dumps(CAPTION | (cap or {})), encoding="utf-8")
    return figures.make(kind, d, out=tmp_path, **kw)


def caught(monkeypatch):
    seen = []
    orig = st.save
    monkeypatch.setattr(st, "save", lambda fig, *a, **k: (seen.append(fig), orig(fig, *a, **k))[1])
    return seen


def inside(fig):
    """Every text of the figure lies inside the figure."""
    fig.canvas.draw()
    r = st.renderer(fig)
    for ax in fig.axes:
        for t in ax.texts:
            b = t.get_window_extent(r)
            assert b.x1 <= fig.bbox.x1 + 1 and b.x0 >= fig.bbox.x0 - 1, t.get_text()


# 1. dot plot, tiny values
def test_dots_log_axis_with_unit_column_and_tiny_label(tmp_path):
    text = csv_rows("Wheat,a,0.00001,tonne", "Wood,a,0.01,m3", "Gas,a,40,m3")
    svg = make(tmp_path, "dots", text, {"log": True, "unit_column": True, "note": "ratio scale."})[0]
    body = svg.read_text(encoding="utf-8")
    assert "&lt;0.1" in body and "tonne" in body


def test_dots_log_refuses_zero_and_a_missing_scale_note(tmp_path):
    with pytest.raises(st.StyleError, match="above zero"):
        make(tmp_path, "dots", csv_rows("A,a,0", "B,a,5"), {"log": True, "note": "ratio scale."})
    with pytest.raises(st.StyleError, match="ratio scale"):
        make(tmp_path, "dots", csv_rows("A,a,1", "B,a,5"), {"log": True})


def test_bars_label_form_for_tiny_values():
    assert st.num_label(0.00001) == "<0.1" and st.num_label(0) == "0" and st.num_label(2.5) == "2.5"
    assert st.num_label(0.05, 0.1) == "<0.1"


# 2. stacked
def stacked_text(n, with_zero=True):
    names = "ABCDEFGH"[:n]
    share = [100 // n] * n
    share[0] += 100 - sum(share)
    if with_zero:
        share[0] += share[1]
        share[1] = 0
    return csv_rows(*[f"{s},2025,{v}" for s, v in zip(names, share)])


def test_stacked_holds_eight_parts_and_a_legend_entry_for_each(tmp_path, monkeypatch):
    seen = caught(monkeypatch)
    make(tmp_path, "stacked", stacked_text(8))
    names = [t.get_text() for t in seen[0].axes[0].get_legend().get_texts()]
    assert len(names) == 8 and names[1] == "B (0)"
    with pytest.raises(st.StyleError, match="at most"):
        make(tmp_path, "stacked", csv_rows(*[f"P{i},2025,{100 / 9:.3f}" for i in range(9)]))


def test_stacked_upper_bound_marks(tmp_path, monkeypatch):
    seen = caught(monkeypatch)
    make(tmp_path, "stacked", stacked_text(4, False), {"upper": {"D": {"2025": 40}}})
    assert "high bound" in [t.get_text() for t in seen[0].axes[0].get_legend().get_texts()]
    with pytest.raises(st.StyleError, match="below its value"):
        make(tmp_path, "stacked", stacked_text(4, False), {"upper": {"D": {"2025": 1}}})


# 3. two panels
def test_line_two_panels_share_one_caption(tmp_path, monkeypatch):
    seen = caught(monkeypatch)
    text = csv_rows("S,2020,1,u,P1", "S,2021,2,u,P1", "S,2020,5,v,P2", "S,2021,3,v,P2", extra="panel")
    out = make(tmp_path, "line", text, {"note": "does not start at zero."})
    assert len(seen[0].axes) == 2 and len(out) == 3
    assert [a.get_title(loc="left") for a in seen[0].axes] == ["P1 (u)", "P2 (v)"]


# 4. spread
def test_spread_from_items_and_from_summary_rows(tmp_path, monkeypatch):
    five, pts = __import__("spread").summary(
        [{"serie": "G", "periode": f"i{k}", "valeur": float(k)} for k in range(1, 6)])
    assert five == [1, 2, 3, 4, 5] and len(pts) == 5
    summ = csv_rows(*[f"G,{k},{v}" for k, v in zip(("min", "Q1", "median", "Q3", "max"), (1, 2, 3, 4, 9))])
    assert make(tmp_path, "spread", summ, {"zero": True})[0].exists()
    with pytest.raises(st.StyleError, match="three items"):
        make(tmp_path, "spread", csv_rows("G,a,1", "G,b,2"), {"zero": True})
    with pytest.raises(st.StyleError, match="not in order"):
        make(tmp_path, "spread", csv_rows(*[f"G,{k},{v}" for k, v in zip(("min", "q1", "median", "q3", "max"), (1, 5, 3, 4, 9))]),
             {"zero": True})


def test_bars_draw_a_set_overlap(tmp_path):
    text = csv_rows("A only,x,40", "A + B,x,12", "A + B + C,x,3")
    assert make(tmp_path, "bars", text, {"label_all": True})[0].exists()


# 5. end labels
def test_spread_moves_close_labels_apart_and_keeps_far_ones():
    out = st.spread([10.0, 11.0, 90.0], 5)
    assert out[1] - out[0] == pytest.approx(5) and out[2] == 90.0
    assert sum(out[:2]) == pytest.approx(21)


def test_line_end_labels_do_not_overlap(tmp_path, monkeypatch):
    seen = caught(monkeypatch)
    text = csv_rows("Value,2020,10", "Value,2021,17.1", "Volume,2020,9", "Volume,2021,13.1")
    make(tmp_path, "line", text, {"zero": True})
    fig = seen[0]
    fig.canvas.draw()
    r = st.renderer(fig)
    a, b = (t.get_window_extent(r) for t in fig.axes[0].texts if t.get_text().startswith("V"))
    assert not a.overlaps(b)


# 6. locale
def test_locale_fr_number_words_and_caption(tmp_path):
    st.configure("fr")
    assert st.num(8477) == "8 477" and st.num(17.1) == "17,1" and st.num_label(0.01) == "<0,1"
    assert st.regime_label("US") == "États-Unis" and st.regime_label("multi") == "Deux séries ou plus"
    st.configure("en")
    assert st.num(8477) == "8,477" and st.regime_label("US") == "US"
    cap = make(tmp_path, "table", "A,B\n1,2\n", locale="fr")[0].read_text(encoding="utf-8")
    assert "Tableau 9." in cap and "Source :" in cap and "Note :" in cap
    cap = make(tmp_path, "bars", csv_rows("A,x,3,u"), locale="fr")[2].read_text(encoding="utf-8")
    assert "Figure 9." in cap and "Source :" in cap


def test_locale_default_is_english_and_unknown_is_refused(tmp_path):
    assert "Source:" in make(tmp_path, "bars", csv_rows("A,x,3"))[2].read_text(encoding="utf-8")
    with pytest.raises(st.StyleError, match="locale"):
        make(tmp_path, "bars", csv_rows("A,x,3"), locale="de")


# 7. clipped labels
def test_no_label_is_clipped_at_the_right_edge(tmp_path, monkeypatch):
    seen = caught(monkeypatch)
    make(tmp_path, "bars", csv_rows("Alpha,x,489.123", "Beta,x,3"), {"label_all": True})
    make(tmp_path, "dots", csv_rows("Alpha,x,489123", "Beta,x,3"))
    make(tmp_path, "dumbbell", csv_rows("A,2020,5", "A,2025,98765", "B,2020,7", "B,2025,3"))
    make(tmp_path, "line", csv_rows("Value,2020,10", "Value,2021,17.1000"), {"zero": True})
    for fig in seen:
        inside(fig)


# 8. axis note in one place
def test_axis_note_phrase_follows_the_locale(tmp_path):
    text = csv_rows("S,2020,1", "S,2021,2")
    with pytest.raises(st.StyleError, match="ne commence pas à zéro"):
        make(tmp_path, "line", text, {"note": "does not start at zero."}, locale="fr")
    assert make(tmp_path, "line", text, {"note": "L'axe ne commence pas à zéro."}, locale="fr")[0].exists()
    assert make(tmp_path, "line", text, {"note": "does not start at zero."})[0].exists()


# 9. unstored documents
@pytest.mark.parametrize("doc", ["doc_000000000", "doc_0123456789abc", "doc_0123456789AB", "release à sec (non stocké)"])
def test_read_data_refuses_a_bad_document(tmp_path, doc):
    with pytest.raises(st.StyleError, match="doc_"):
        make(tmp_path, "bars", csv_rows("A,x,3", doc=doc))


def test_allow_unstored_warns_and_marks_the_caption(tmp_path, capsys):
    out = make(tmp_path, "bars", csv_rows("A,x,3", doc="non stocké"), allow_unstored=True)
    assert "warning" in capsys.readouterr().err
    assert "non stocké" in out[2].read_text(encoding="utf-8")
    # the next run is strict again and its caption is clean
    assert "non stocké" not in make(tmp_path, "bars", csv_rows("A,x,3"))[2].read_text(encoding="utf-8")


def test_cli_flags(tmp_path):
    d = tmp_path / "d.csv"
    d.write_text(csv_rows("A,x,3", doc="none"), encoding="utf-8")
    (tmp_path / "d.caption.json").write_text(json.dumps(CAPTION))
    assert figures.main(["bars", str(d), "--out", str(tmp_path)]) == 1
    assert figures.main(["bars", str(d), "--out", str(tmp_path), "--allow-unstored", "--locale", "fr"]) == 0


# review fixes
def test_dots_honours_a_axis_that_does_not_start_at_zero(tmp_path, monkeypatch):
    seen = caught(monkeypatch)
    make(tmp_path, "dots", csv_rows("A,a,50", "B,a,60"), {"zero": False, "note": "does not start at zero."})
    assert seen[0].axes[0].get_xlim()[0] > 0


def test_dots_log_with_one_value_and_bars_with_a_wrong_highlight(tmp_path):
    assert make(tmp_path, "dots", csv_rows("A,a,5"), {"log": True, "note": "ratio scale."})[0].exists()
    with pytest.raises(st.StyleError, match="highlight"):
        make(tmp_path, "bars", csv_rows("A,x,1", "B,x,2"), {"highlight": ["Z"]})


def test_stacked_names_a_wrong_upper_key(tmp_path):
    with pytest.raises(st.StyleError, match="names no part"):
        make(tmp_path, "stacked", stacked_text(4, False), {"upper": {"Z": {"2025": 40}}})


def test_dots_label_max_writes_only_the_larger_value_of_each_category(tmp_path):
    text = csv_rows("A,value,81", "A,quantity,63", "B,value,33", "B,quantity,47")
    svg = make(tmp_path, "dots", text, {"labels": "max", "note": "Synthetic."})[0].read_text(encoding="utf-8")
    assert ">81<" in svg and ">47<" in svg and ">63<" not in svg and ">33<" not in svg
