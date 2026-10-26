"""Builds the glyph files (SDF, Mapbox PBF format) that the map reads for its labels.

Run `python tools/map-glyphs/build.py` from the repository root. It reads the Geist fonts of
`@fontsource` (pnpm install first) and writes `public/map-fonts/<stack>/<first>-<last>.pbf`.
It needs fonttools, brotli, numpy, scipy and pillow. The files are committed, so a build of the
application never runs this script.
"""
import io
import pathlib

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt

ROOT = pathlib.Path(__file__).resolve().parents[2]
SIZE = 24  # the size of a glyph in a glyph file, in pixels
BUFFER = 3  # the free border around each bitmap
RADIUS = 8  # the reach of the distance field, in pixels
CUTOFF = 0.25  # the share of the field that lies inside the outline
SCALE = 8  # the glyph is drawn this many times larger, then reduced
SUBSETS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext']
STACKS = {'Geist': 'geist', 'GeistMono': 'geist-mono'}
RANGES = [(0, 255), (256, 511), (512, 767), (1024, 1279), (1280, 1535), (7680, 7935), (8192, 8447), (8448, 8703)]


def varint(n):
    out = bytearray()
    while True:
        if n < 128:
            out.append(n)
            return bytes(out)
        out.append((n & 127) | 128)
        n >>= 7


def zigzag(n):
    return (n << 1) ^ (n >> 31)


def field(number, wire, payload):
    key = varint((number << 3) | wire)
    return key + (varint(len(payload)) + payload if wire == 2 else payload)


def load(package, subset):
    font = TTFont(ROOT / f'node_modules/@fontsource/{package}/files/{package}-{subset}-400-normal.woff')
    font.flavor = None
    data = io.BytesIO()
    font.save(data)
    data.seek(0)
    return font, data.getvalue()


def glyph(code, face, upm_ascent):
    ch = chr(code)
    big = ImageFont.truetype(io.BytesIO(face), SIZE * SCALE)
    advance = round(big.getlength(ch) / SCALE)
    pad = 6 * SCALE
    canvas = Image.new('L', (SIZE * SCALE * 3, SIZE * SCALE * 3), 0)
    origin = (pad + SIZE * SCALE, SIZE * SCALE * 2)
    ImageDraw.Draw(canvas).text(origin, ch, font=big, fill=255, anchor='ls')
    ink = np.asarray(canvas) > 127
    ys, xs = np.nonzero(ink)
    if len(xs) == 0:
        return field(1, 0, varint(code)) + field(3, 0, varint(0)) + field(4, 0, varint(0)) + field(5, 0, varint(0)) + field(6, 0, varint(zigzag(-upm_ascent))) + field(7, 0, varint(advance))
    left = int(np.floor((xs.min() - origin[0]) / SCALE))
    top = int(np.ceil((origin[1] - ys.min()) / SCALE))  # above the baseline
    right = int(np.ceil((xs.max() + 1 - origin[0]) / SCALE))
    bottom = int(np.ceil((ys.max() + 1 - origin[1]) / SCALE))  # below the baseline
    width, height = right - left, top + bottom
    inside = distance_transform_edt(ink)
    outside = distance_transform_edt(~ink)
    signed = (inside - outside) / SCALE  # in output pixels, positive inside
    rows = []
    for y in range(-BUFFER, height + BUFFER):
        for x in range(-BUFFER, width + BUFFER):
            cx = origin[0] + (left + x) * SCALE + SCALE // 2
            cy = origin[1] + (-top + y) * SCALE + SCALE // 2
            d = signed[cy, cx] if 0 <= cy < signed.shape[0] and 0 <= cx < signed.shape[1] else -RADIUS
            rows.append(d)
    value = np.clip(255 * ((1 - CUTOFF) + np.array(rows) / RADIUS), 0, 255).astype(np.uint8)
    return (
        field(1, 0, varint(code))
        + field(2, 2, value.tobytes())
        + field(3, 0, varint(width))
        + field(4, 0, varint(height))
        + field(5, 0, varint(zigzag(left)))
        + field(6, 0, varint(zigzag(top - upm_ascent)))
        + field(7, 0, varint(advance))
    )


def main():
    for stack, package in STACKS.items():
        faces = [load(package, subset) for subset in SUBSETS]
        ascent = round(faces[0][0]['hhea'].ascent * SIZE / faces[0][0]['head'].unitsPerEm)
        owner = {}
        for font, data in reversed(faces):
            for code in font.getBestCmap():
                owner[code] = data
        out = ROOT / 'public' / 'map-fonts' / stack
        out.mkdir(parents=True, exist_ok=True)
        for first, last in RANGES:
            codes = [c for c in range(first, last + 1) if c in owner]
            if not codes:
                continue
            body = b''.join(field(3, 2, glyph(c, owner[c], ascent)) for c in codes)
            stackmsg = field(1, 2, stack.encode()) + field(2, 2, f'{first}-{last}'.encode()) + body
            (out / f'{first}-{last}.pbf').write_bytes(field(1, 2, stackmsg))
            print(stack, first, last, len(codes))


main()
