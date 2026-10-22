"""Build data/basemap.json from the Natural Earth 50m countries file (public domain).

    python tools/figures/build_basemap.py ne_50m_admin_0_countries.geojson

The map covers Europe and northern Asia. Outer rings only, simplified, two decimals.
"""
import json
import sys
from pathlib import Path

from shapely.geometry import box, shape

BBOX = (-30, 25, 150, 82)
TOLERANCE = 0.08


def rings(geom):
    for p in getattr(geom, "geoms", [geom]):
        if p.geom_type == "Polygon" and not p.is_empty:
            yield [[round(x, 2), round(y, 2)] for x, y in p.exterior.coords]


def main(src):
    clip, out = box(*BBOX), []
    for f in json.loads(Path(src).read_text(encoding="utf-8"))["features"]:
        g = shape(f["geometry"]).intersection(clip).simplify(TOLERANCE)
        out += list(rings(g))
    (Path(__file__).parent / "data" / "basemap.json").write_text(
        json.dumps({"source": "Natural Earth, public domain", "bbox": BBOX, "polygons": out},
                   separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
