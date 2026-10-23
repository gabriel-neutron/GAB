"""Tests of the kinds flow, map, timeline, step, tiles, dotmatrix, heatgrid and multiples. Data is synthetic."""
import json
import re

import pytest

import figures
import style as st
from test_kinds import caught, inside

CAPTION = {"number": 1, "title": "Synthetic message", "source": "[1].", "note": "Synthetic."}


def make(tmp_path, kind, data, cap=None, **kw):
    d = tmp_path / "d.json"
    d.write_text(json.dumps(data), encoding="utf-8")
    (tmp_path / "d.caption.json").write_text(json.dumps(CAPTION | (cap or {})), encoding="utf-8")
    return figures.make(kind, d, out=tmp_path, **kw)


def run(tmp_path, monkeypatch, kind, data, cap=None, **kw):
    """Make a figure in French with a grey check; the texts must stay inside the figure."""
    seen = caught(monkeypatch)
    files = make(tmp_path, kind, data, cap, locale="fr", grey=True, **kw)
    inside(seen[0])
    assert (tmp_path / "d.grey.png").exists() and "<text" in files[0].read_text(encoding="utf-8")
    return files


FLOW = {"cols": 3, "rows": ["Production", "Transport", "Paiement"], "nodes": [
    {"id": "a", "label": "Extraction du brut", "col": 0, "row": 0},
    {"id": "b", "label": "Terminal", "col": 1, "row": 0, "state": "dashed"},
    {"id": "c", "label": "Navire", "col": 1, "row": 1},
    {"id": "d", "label": "Finance", "col": 2, "row": 2, "state": "hatched"}],
    "edges": [{"from": "a", "to": "b", "source": "[1]"}, {"from": "b", "to": "c", "source": "[2]", "state": "dashed"}]}


def test_flow(tmp_path, monkeypatch):
    run(tmp_path, monkeypatch, "flow", FLOW)


def test_flow_keeps_the_source_key_off_the_arrow_when_the_caption_holds_it(tmp_path):
    shown = make(tmp_path, "flow", FLOW)[0].read_text(encoding="utf-8")
    hidden = make(tmp_path, "flow", FLOW, {"edge_keys": False})[0].read_text(encoding="utf-8")
    assert "[2]" in shown and "[2]" not in hidden


def test_flow_refuses_an_arrow_without_source_or_into_a_hatched_node(tmp_path):
    bad = json.loads(json.dumps(FLOW))
    bad["edges"][0].pop("source")
    with pytest.raises(st.StyleError, match="no source"):
        make(tmp_path, "flow", bad)
    bad = json.loads(json.dumps(FLOW))
    bad["edges"].append({"from": "c", "to": "d", "source": "[3]"})
    with pytest.raises(st.StyleError, match="hatched"):
        make(tmp_path, "flow", bad)


MAP = {"bbox": [20, 40, 60, 60], "scale_km": 500, "basemap": "base.json", "points": [
    {"id": "p1", "label": "Terminal A", "lon": 30, "lat": 50, "status": "active", "since": "2025-01", "source": "[1]"},
    {"id": "p2", "label": "Terminal B", "lon": 31, "lat": 50.5, "status": "stopped", "since": "2024-06", "source": "[2]",
     "approx": True},
    {"id": "p3", "label": "Terminal C", "lon": 45, "lat": 55, "status": "exempted", "since": "2023-03", "source": "[3]"}],
    "lines": [{"id": "l1", "label": "Line", "coords": [[30, 50], [45, 55]], "status": "active", "since": "2025-01",
               "source": "[1]"}]}


def map_data(tmp_path):
    (tmp_path / "base.json").write_text(json.dumps({"polygons": [[[22, 42], [58, 42], [58, 58], [22, 58]]]}))
    return MAP


def test_map_with_status_marker_scale_and_source_line(tmp_path, monkeypatch):
    svg = run(tmp_path, monkeypatch, "map", map_data(tmp_path))[0].read_text(encoding="utf-8")
    for words in ("Localisation approximative", "Fond de carte", "500 km", "Actif", "Arrêté", "Exempté"):
        assert words in svg


def test_map_default_basemap_is_in_the_repo(tmp_path):
    data = dict(MAP) | {"basemap": None}
    make(tmp_path, "map", data)


def test_map_refuses_a_missing_date_status_or_source(tmp_path):
    for key, match in (("since", "no date"), ("status", "unknown status"), ("source", "no source")):
        data = json.loads(json.dumps(map_data(tmp_path)))
        data["points"][0].pop(key)
        with pytest.raises(st.StyleError, match=match):
            make(tmp_path, "map", data)


def test_map_stops_when_labels_cannot_be_placed(tmp_path):
    data = json.loads(json.dumps(map_data(tmp_path)))
    data["points"] = [data["points"][0] | {"id": f"q{i}", "label": "A very long label of a crowded terminal " * 3}
                      for i in range(12)]
    with pytest.raises(st.StyleError, match="no free place"):
        make(tmp_path, "map", data)


def test_map_labels_do_not_overlap(tmp_path, monkeypatch):
    data = json.loads(json.dumps(map_data(tmp_path)))
    data["points"] = [data["points"][0] | {"id": f"q{i}", "label": f"Site {i}", "lon": 30 + i * 0.4} for i in range(5)]
    seen = caught(monkeypatch)
    make(tmp_path, "map", data)
    fig = seen[0]
    r = st.renderer(fig)
    boxes = [t.get_window_extent(r) for t in fig.axes[0].texts if t.get_text().startswith("Site")]
    assert len(boxes) == 5 and not any(a.overlaps(b) for i, a in enumerate(boxes) for b in boxes[i + 1:])


TIMELINE = {"start": "2014-01-01", "end": "2026-12-31", "events": [
    {"date": "2014-03-17", "label": "Paquet 1", "source": "[1]"}, {"date": "2014-07-31", "label": "Paquet 2", "source": "[1]"},
    {"date": "2022-02-23", "label": "Paquet 3", "source": "[2]"}, {"date": "2024-06-24", "label": "Paquet 14", "source": "[3]"}],
    "bands": [{"from": "2022-12-05", "to": "2025-09-01", "label": "Plafond", "source": "[4]"},
              {"from": "2026-01-01", "to": "2026-12-31", "label": "Gaz", "source": "[5]"}]}


def test_timeline(tmp_path, monkeypatch):
    run(tmp_path, monkeypatch, "timeline", TIMELINE)


def test_timeline_refuses_an_event_without_source_or_out_of_range(tmp_path):
    bad = json.loads(json.dumps(TIMELINE))
    bad["events"][0].pop("source")
    with pytest.raises(st.StyleError, match="no source"):
        make(tmp_path, "timeline", bad)
    bad = json.loads(json.dumps(TIMELINE))
    bad["events"][0]["date"] = "2000-01-01"
    with pytest.raises(st.StyleError, match="outside"):
        make(tmp_path, "timeline", bad)


STEP = {"end": "2026-06-30", "steps": [{"date": "2022-12-05", "value": 60}, {"date": "2024-02-01", "value": 47.6},
                                       {"date": "2025-09-03", "value": 44.1}],
        "curve": [{"date": "2022-12-01", "value": 55}, {"date": "2024-06-01", "value": 70}, {"date": "2026-01-01", "value": 50}]}


def test_step(tmp_path, monkeypatch):
    svg = run(tmp_path, monkeypatch, "step", STEP, {"unit": "USD/bbl"})[0].read_text(encoding="utf-8")
    assert "47,6" in svg


def test_step_refuses_an_end_before_the_last_step(tmp_path):
    with pytest.raises(st.StyleError, match="end date"):
        make(tmp_path, "step", STEP | {"end": "2023-01-01"})


TILES = {"tiles": [{"value": 35.8, "unit": "%", "label": "Part du pétrole et du gaz dans le budget", "source": "[1]"},
                   {"value": "431/596", "unit": "navires", "label": "Navires inscrits", "source": "[2]"},
                   {"value": 22.7, "unit": "%", "label": "Part en 2025", "source": "[3]"},
                   {"value": 18.5, "unit": "%", "label": "Part prévue en 2026", "source": "[4]"}]}


def test_tiles_write_the_number_in_the_locale(tmp_path, monkeypatch):
    svg = run(tmp_path, monkeypatch, "tiles", TILES)[0].read_text(encoding="utf-8")
    assert "35,8" in svg and "431/596" in svg
    assert "[1]" not in svg  # the source key is in the caption, not under the tile


def test_tiles_refuse_a_tile_without_source(tmp_path):
    with pytest.raises(st.StyleError, match="no source"):
        make(tmp_path, "tiles", {"tiles": [{"value": 1, "label": "x"}]})


DOTS = {"conditions": ["a", "b", "c"], "rows": [
    {"label": "Candidat 1", "marks": ["full", "full", "half"]}, {"label": "Candidat 2", "marks": ["full", "empty", "empty"]},
    {"label": "Candidat long nom 3", "marks": ["half", "half", "full"]}]}


def test_dotmatrix(tmp_path, monkeypatch):
    svg = run(tmp_path, monkeypatch, "dotmatrix", DOTS)[0].read_text(encoding="utf-8")
    assert "Condition remplie" in svg and "Candidat long nom 3" in svg


def test_dotmatrix_refuses_a_bad_mark(tmp_path):
    with pytest.raises(st.StyleError, match="bad marks"):
        make(tmp_path, "dotmatrix", {"conditions": ["a"], "rows": [{"label": "X", "marks": ["red"]}]})


HEAT = {"rows": ["Finance", "Transport"], "cols": ["Texte", "Presse", "Registre"], "levels": ["aucune", "faible", "forte"],
        "cells": [[0, 1, None], [2, 2, 1]]}


def test_heatgrid(tmp_path, monkeypatch):
    run(tmp_path, monkeypatch, "heatgrid", HEAT)


def test_heatgrid_refuses_an_unknown_level(tmp_path):
    with pytest.raises(st.StyleError, match="level that does not exist"):
        make(tmp_path, "heatgrid", HEAT | {"cells": [[0, 3, 0], [0, 0, 0]]})


def test_heatgrid_levels_differ_in_grey():
    from heatgrid import STEPS
    assert all(st.lightness(a) - st.lightness(b) >= st.MIN_GREY_STEP for a, b in zip(STEPS, STEPS[1:]))
    assert all(st.chroma(c) <= st.CHROMA_LIMIT for c in STEPS)


MULT = {"panels": [{"title": f"{k}. Panel", "series": [{"name": "s", "points": [[2020, 10 * (i + 1)], [2025, 5 + 3 * i]]}]}
                   for i, k in enumerate("abcd")], "ncols": 2}


def test_multiples_share_the_axes(tmp_path, monkeypatch):
    seen = caught(monkeypatch)
    make(tmp_path, "multiples", MULT, {"unit": "USD bn"}, locale="fr")
    axes = seen[0].axes
    assert len(axes) == 4 and all(a.get_ylim() == axes[0].get_ylim() for a in axes)


def test_multiples_refuse_one_panel(tmp_path):
    with pytest.raises(st.StyleError, match="two to nine"):
        make(tmp_path, "multiples", {"panels": MULT["panels"][:1]})


# size classes, and the title of a message
@pytest.mark.parametrize("size,mm", [("third", 70), ("half", 110), ("full", 210)])
def test_size_class_sets_the_height(tmp_path, monkeypatch, size, mm):
    seen = caught(monkeypatch)
    make(tmp_path, "tiles", {"tiles": TILES["tiles"][:3]}, {"size": size})
    assert seen[0].get_figheight() * 25.4 == pytest.approx(mm)


def test_unknown_size_class_is_refused(tmp_path):
    with pytest.raises(st.StyleError, match="size class"):
        make(tmp_path, "tiles", TILES, {"size": "double"})


def test_a_title_of_more_than_eight_words_warns(tmp_path):
    with pytest.warns(UserWarning, match="more than 8 words"):
        make(tmp_path, "tiles", TILES, {"title": "one two three four five six seven eight nine"})
    make(tmp_path, "tiles", TILES, {"title": "one two three four five six seven eight"})


def test_size_class_smaller_than_the_content_is_refused(tmp_path):
    many = {"tiles": TILES["tiles"] * 2}
    with pytest.raises(st.StyleError, match="too small"):
        make(tmp_path, "tiles", many, {"size": "third"})
    make(tmp_path, "tiles", many, {"size": "third", "height_mm": 60})  # an explicit height squeezes the figure


def test_map_scale_bar_has_the_true_length(tmp_path, monkeypatch):
    import math
    seen = caught(monkeypatch)
    make(tmp_path, "map", map_data(tmp_path) | {"bbox": [20, 40, 60, 70], "scale_km": 500})
    ax = seen[0].axes[0]
    xs = [ln.get_xdata() for ln in ax.lines if len(ln.get_xdata()) == 2 and ln.get_linewidth() == 2][0]
    assert (xs[1] - xs[0]) * 111.32 * math.cos(math.radians(55)) == pytest.approx(500, rel=0.01)


def test_timeline_refuses_a_fifth_band_and_a_reversed_band(tmp_path):
    band = TIMELINE["bands"][0]
    with pytest.raises(st.StyleError, match="at most"):
        make(tmp_path, "timeline", TIMELINE | {"bands": [band] * 4})
    with pytest.raises(st.StyleError, match="earlier"):
        make(tmp_path, "timeline", TIMELINE | {"bands": [band | {"from": "2025-01-01", "to": "2024-01-01"}]})
