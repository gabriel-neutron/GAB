"""Each figure kind runs from a data file and writes its files. Data is synthetic."""
import json
import re
import shutil
from pathlib import Path

import numpy as np
import pytest

import figures
import style as st

FIX = Path(__file__).parent / "fixtures"
CAPTION = {"number": 9, "title": "Synthetic", "unit": "unit", "source": "Synthetic.", "note": "Synthetic."}


def rows(*lines):
    head = "serie,periode,valeur,unite,document,page,extrait_ou_cellule,note\n"
    return head + "".join(f"{x},u,doc_000000000003,1,,\n" for x in lines)


def check_width(svg):
    w = float(re.search(r'<svg[^>]* width="([\d.]+)pt"', svg.read_text(encoding="utf-8")).group(1))
    assert w == pytest.approx(st.WIDTH_MM / 25.4 * 72, abs=0.5)


@pytest.mark.parametrize("name,kind", [("line", "line"), ("bars", "bars")])
def test_reference_figures(tmp_path, name, kind):
    svg, png, cap = figures.make(kind, FIX / f"{name}.csv", out=tmp_path, grey=True)
    check_width(svg)
    assert "<text" in svg.read_text(encoding="utf-8")  # text stays text
    assert png.stat().st_size > 1000 and (tmp_path / f"{name}.grey.png").exists()
    assert cap.read_text(encoding="utf-8").startswith('<p class="caption"><strong>Figure')


def test_line_refuses_an_axis_note_that_is_missing(tmp_path):
    cap = json.loads((FIX / "line.caption.json").read_text())
    cap["note"] = "Synthetic."
    (tmp_path / "c.json").write_text(json.dumps(cap))
    with pytest.raises(st.StyleError, match="does not start at zero"):
        figures.make("line", FIX / "line.csv", tmp_path / "c.json", tmp_path)


def test_line_refuses_four_series(tmp_path):
    d = tmp_path / "four.csv"
    d.write_text(rows(*[f"S{i},2020,{i}" for i in range(4)]).replace(",,\n", ",x,\n", 0))
    (tmp_path / "four.caption.json").write_text(json.dumps(CAPTION | {"note": "does not start at zero"}))
    with pytest.raises(st.StyleError, match="at most"):
        figures.make("line", d, out=tmp_path)


def _write(tmp_path, name, text):
    p = tmp_path / name
    p.write_text(text, encoding="utf-8")
    (tmp_path / f"{Path(name).stem}.caption.json").write_text(json.dumps(CAPTION))
    return p


def test_dumbbell_and_stacked(tmp_path):
    d = _write(tmp_path, "db.csv", rows("A,2020,5", "A,2025,9", "B,2020,7", "B,2025,3"))
    assert figures.make("dumbbell", d, out=tmp_path)[0].exists()
    s = _write(tmp_path, "st.csv", rows("X,2025,60", "Y,2025,37", "Z,2025,3", "X,2026,50", "Y,2026,45", "Z,2026,5"))
    assert figures.make("stacked", s, out=tmp_path)[0].exists()


def test_table_badge_inference(tmp_path):
    t = _write(tmp_path, "t.csv", "Act,Date,Count,Note\nReg 1,2022-02-24,1200,\nReg 2,2022-03-02,35,x\n")
    html = figures.make("table", t, out=tmp_path)[0].read_text(encoding="utf-8")
    assert "Table 9." in html and "–" in html and 'class="num mono"' in html
    b = tmp_path / "b.json"
    b.write_text(json.dumps({"code": "B2", "record": "https://example.org/r"}))
    assert all(p.exists() for p in figures.make("badge", b, out=tmp_path))
    i = tmp_path / "i.json"
    i.write_text(json.dumps({"level": "likely or probably", "confidence": "moderate", "text": "Synthetic."}))
    assert "55–75" in figures.make("inference", i, out=tmp_path)[0].read_text(encoding="utf-8")


def test_chain(tmp_path):
    spec = {"columns": ["Maker", "Trader", "Shipper"],
            "nodes": [{"id": "a", "label": "Firm A", "country": "AA", "column": "Maker"},
                      {"id": "b", "label": "Firm B", "country": "BB", "column": "Trader", "designated": "UK"},
                      {"id": "c", "label": "Firm C", "country": "CC", "column": "Shipper"}],
            "edges": [{"from": "a", "to": "b", "date": "2025-01-02", "pair": "B2", "kind": "fact"},
                      {"from": "b", "to": "c", "date": "2025-02-03", "pair": "C3", "kind": "assessment"}]}
    c = _write(tmp_path, "c.json", json.dumps(spec))
    assert figures.make("chain", c, out=tmp_path)[0].exists()


def test_plate(tmp_path):
    import matplotlib.pyplot as plt
    rng = np.random.default_rng(1)
    for k in ("before", "after"):
        plt.imsave(tmp_path / f"{k}.png", rng.random((60, 80)), cmap="gray")
    scene = {"date_utc": "2026-01-02 10:00", "sensor": "Synthetic sensor", "scene": "SYN_0001", "bands": "B04 B03 B02"}
    spec = {"before": scene | {"image": "before.png"}, "after": scene | {"image": "after.png"},
            "pixel_m": 10, "scale_bar_m": 200, "marks": [{"x": 20, "y": 20, "w": 20, "h": 15}]}
    p = _write(tmp_path, "p.json", json.dumps(spec))
    assert figures.make("plate", p, out=tmp_path)[0].exists()


def test_one_command_from_the_shell(tmp_path):
    assert figures.main(["line", str(FIX / "line.csv"), "--out", str(tmp_path)]) == 0
    assert figures.main(["nothing", str(FIX / "line.csv")]) == 1


def test_manifest_makes_all(tmp_path):
    for n in ("line", "bars"):
        for ext in ("csv", "caption.json"):
            shutil.copy(FIX / f"{n}.{ext}", tmp_path / f"{n}.{ext}")
    m = tmp_path / "m.json"
    m.write_text(json.dumps([{"kind": "line", "data": "line.csv"}, {"kind": "bars", "data": "bars.csv"}]))
    assert figures.main(["all", str(m), "--out", str(tmp_path / "o")]) == 0
    assert (tmp_path / "o" / "line.svg").exists() and (tmp_path / "o" / "bars.png").exists()


def _size_of(svg):
    head = re.search(r"<svg[^>]*>", svg.read_text(encoding="utf-8")).group(0)
    return [float(re.search(rf' {a}="([\d.]+)pt"', head).group(1)) / 72 * 25.4 for a in ("width", "height")]


@pytest.mark.parametrize("size,w,h", [("third", 166, 70), ("half", 166, 110), ("full", 166, 210), ("pair", 81, 80)])
def test_size_class_sets_the_page_size_of_every_kind(tmp_path, size, w, h):
    cap = json.loads((FIX / "bars.caption.json").read_text()) | {"size": size}
    (tmp_path / "c.json").write_text(json.dumps(cap))
    svg = figures.make("bars", FIX / "bars.csv", tmp_path / "c.json", tmp_path)[0]
    assert _size_of(svg) == pytest.approx([w, h], abs=0.3)


def test_a_width_of_one_figure_does_not_leak_to_the_next(tmp_path):
    cap = json.loads((FIX / "bars.caption.json").read_text())
    (tmp_path / "p.json").write_text(json.dumps(cap | {"size": "pair"}))
    figures.make("bars", FIX / "bars.csv", tmp_path / "p.json", tmp_path / "a")
    svg = figures.make("bars", FIX / "bars.csv", FIX / "bars.caption.json", tmp_path / "b")[0]
    assert _size_of(svg)[0] == pytest.approx(166, abs=0.3)


def test_height_mm_overrides_the_class_and_an_unknown_class_stops(tmp_path):
    cap = json.loads((FIX / "bars.caption.json").read_text())
    (tmp_path / "c.json").write_text(json.dumps(cap | {"size": "half", "height_mm": 55}))
    assert _size_of(figures.make("bars", FIX / "bars.csv", tmp_path / "c.json", tmp_path)[0])[1] == pytest.approx(55, abs=0.3)
    (tmp_path / "d.json").write_text(json.dumps(cap | {"size": "huge"}))
    with pytest.raises(st.StyleError, match="unknown size class"):
        figures.make("bars", FIX / "bars.csv", tmp_path / "d.json", tmp_path)
