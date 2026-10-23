"""The design tokens of the figures, read from the site stylesheet (`src/index.css`).

Standard library only: the figure tool (`style.py`) and the hand-made scripts import it.
Set FIGURE_TOKENS to the path of another stylesheet to read a different one.
A token is a light-theme `oklch(...)` value of `:root`; `hex(name)` converts it.
"""
import math
import os
import re
from pathlib import Path

CSS = Path(os.environ.get("FIGURE_TOKENS") or Path(__file__).resolve().parents[2] / "src" / "index.css")

# Fonts of the Dossier style. The site has no serif face: Source Serif 4 (SIL OFL) is the body face.
FONTS = {"serif": ["Source Serif 4", "DejaVu Serif"], "mono": ["JetBrains Mono", "DejaVu Sans Mono"]}


def _oklab_to_hex(L, a, b):
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
           -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
           -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_)
    gam = [12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055 for c in lin]
    return "#" + "".join(f"{round(min(1, max(0, c)) * 255):02x}" for c in gam)


def oklch(token):
    """Convert 'oklch(L C H)' to a hex colour."""
    L, C, H = (float(x) for x in re.findall(r"[\d.]+", token)[:3])
    return _oklab_to_hex(L, C * math.cos(math.radians(H)), C * math.sin(math.radians(H)))


def _read():
    block = re.search(r"^:root\s*\{(.*?)^\}", CSS.read_text(encoding="utf-8"), re.S | re.M)
    found = dict(re.findall(r"^\s*--([a-z0-9-]+):\s*(oklch\([^)]*\))", block.group(1), re.M)) if block else {}
    if not found:
        raise ValueError(f"no oklch token in {CSS.name}")
    return found


RAW = _read()


def hex(name):
    """The light-theme colour of a site token, as '#rrggbb'."""
    if name not in RAW:
        raise KeyError(f"the site stylesheet has no oklch token: {name}")
    return oklch(RAW[name])
