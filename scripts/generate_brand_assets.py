#!/usr/bin/env python3
"""Generate Mothlight's light and dark launcher/splash artwork.

The source is vector-like geometry rendered at high resolution with Pillow,
so native builds never depend on a transferred binary image.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUTPUT_SIZE = 1024
SUPERSAMPLE = 4
SCALE = OUTPUT_SIZE / 512 * SUPERSAMPLE
CANVAS = int(512 * SCALE)


def scaled(point: tuple[float, float]) -> tuple[int, int]:
    return round(point[0] * SCALE), round(point[1] * SCALE)


def cubic(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    steps: int = 28,
) -> list[tuple[float, float]]:
    result = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0]
        y = u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]
        result.append((x, y))
    return result


def chain(segments: Iterable[tuple[tuple[float, float], ...]]) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for segment in segments:
        curve_points = cubic(*segment)
        points.extend(curve_points if not points else curve_points[1:])
    return points


def mirror(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [(512 - x, y) for x, y in points]


def star_points(cx: float, cy: float, outer: float, inner: float) -> list[tuple[float, float]]:
    points = []
    for i in range(8):
        radius = outer if i % 2 == 0 else inner
        angle = -3.141592653589793 / 2 + i * 3.141592653589793 / 4
        points.append((cx + radius * __import__("math").cos(angle),
                       cy + radius * __import__("math").sin(angle)))
    return points


def draw_variant(dark: bool, output: Path) -> None:
    colors = {
        "background": "#1D2121" if dark else "#D4D0CD",
        "outline": "#EEE8DC" if dark else "#29272A",
        "page": "#EEE8DC",
        "page_highlight": "#F9F1DC",
        "detail": "#414441" if dark else "#6E6965",
        "halo": "#7A7F73" if dark else "#B1AA9C",
        "sage": "#9DB189",
        "amber": "#D9A453",
        "body": "#EEE8DC" if dark else "#29272A",
    }

    image = Image.new("RGB", (CANVAS, CANVAS), colors["background"])
    draw = ImageDraw.Draw(image)

    def line(points, fill, width=2, joint="curve"):
        draw.line([scaled(p) for p in points], fill=fill,
                  width=max(1, round(width * SCALE)), joint=joint)

    def polygon(points, fill, outline=None, width=0):
        pts = [scaled(p) for p in points]
        draw.polygon(pts, fill=fill)
        if outline:
            line(points + [points[0]], outline, width)

    def ellipse(box, fill=None, outline=None, width=1):
        b = tuple(round(v * SCALE) for v in box)
        draw.ellipse(b, fill=fill, outline=outline,
                     width=max(1, round(width * SCALE)) if outline else 1)

    # A small lantern-star held within a quiet halo.
    ellipse((191, 60, 321, 190), outline=colors["halo"], width=1.25)
    polygon(star_points(256, 94, 18, 4.6), colors["amber"])

    # Upper wings: each wing is shaped like an open book page.
    upper_left = chain([
        ((248, 222), (218, 204), (166, 174), (121, 177)),
        ((121, 177), (81, 179), (48, 192), (34, 220)),
        ((34, 220), (51, 250), (74, 269), (113, 273)),
        ((113, 273), (158, 276), (205, 250), (248, 239)),
    ])
    polygon(upper_left, colors["page"], colors["outline"], 10)
    upper_right = mirror(upper_left)
    polygon(upper_right, colors["page"], colors["outline"], 10)

    # Fine page edges and type-like horizontal strokes.
    upper_detail = [
        (236, 222), (198, 207), (142, 190), (82, 197),
        (52, 220), (78, 247), (133, 253), (220, 235)
    ]
    line(upper_detail, colors["detail"], 1.15)
    line(mirror(upper_detail), colors["detail"], 1.15)
    for y, end_x, offset in [(210, 205, 0), (225, 211, 3), (240, 216, 5)]:
        line([(end_x, y + offset), (91, y - 1 + offset)], colors["detail"], 1.1)
        line([(512-end_x, y + offset), (421, y - 1 + offset)], colors["detail"], 1.1)

    # Lower wings echo the curved lower pages of an open book.
    lower_left = chain([
        ((246, 239), (212, 260), (169, 289), (150, 350)),
        ((150, 350), (180, 361), (218, 373), (247, 351)),
    ])
    lower_left += [(251, 247)]
    polygon(lower_left, colors["page"], colors["outline"], 9)
    lower_right = mirror(lower_left)
    polygon(lower_right, colors["page"], colors["outline"], 9)

    lower_detail = chain([
        ((239, 255), (222, 270), (195, 295), (183, 335)),
        ((183, 335), (205, 344), (226, 350), (241, 340)),
    ])
    line(lower_detail, colors["sage"], 2.2)
    line(mirror(lower_detail), colors["sage"], 2.2)
    line([(226, 264), (199, 297), (191, 323)], colors["detail"], 0.9)
    line([(286, 264), (313, 297), (321, 323)], colors["detail"], 0.9)

    # Antennae and the moth's central body.
    line(chain([
        ((246, 208), (239, 191), (224, 180), (212, 181)),
        ((212, 181), (204, 183), (199, 191), (199, 198)),
    ]), colors["outline"], 2.1)
    line(mirror(chain([
        ((246, 208), (239, 191), (224, 180), (212, 181)),
        ((212, 181), (204, 183), (199, 191), (199, 198)),
    ])), colors["outline"], 2.1)
    ellipse((239, 203, 273, 254), colors["body"])
    ellipse((246, 194, 266, 218), colors["body"])

    # Amber lantern abdomen with engraved dividers.
    lantern = [(243, 246), (269, 246), (267, 310), (256, 326), (245, 310)]
    polygon(lantern, colors["amber"], colors["outline"], 3.2)
    line([(246, 263), (266, 263)], colors["outline"], 1.8)
    line([(246, 282), (266, 282)], colors["outline"], 1.8)
    line([(247, 300), (265, 300)], colors["outline"], 1.8)
    line([(250, 249), (250, 306)], colors["page_highlight"], 1.1)
    line([(262, 249), (262, 306)], colors["page_highlight"], 1.1)

    # Quiet sage markers around the moth.
    ellipse((77, 326, 94, 343), colors["sage"])
    ellipse((418, 326, 435, 343), colors["sage"])
    ellipse((41, 375, 47, 381), colors["sage"])
    ellipse((465, 375, 471, 381), colors["sage"])
    ellipse((80, 107, 87, 114), colors["sage"])
    ellipse((425, 107, 432, 114), colors["sage"])

    image = image.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="PNG", optimize=True, compress_level=9)

    with Image.open(output) as generated:
        generated.verify()
    print(f"Generated {output.relative_to(ROOT)} ({OUTPUT_SIZE}x{OUTPUT_SIZE})")


def main() -> None:
    draw_variant(False, ASSETS / "mothlight-icon.png")
    draw_variant(True, ASSETS / "mothlight-icon-dark.png")


if __name__ == "__main__":
    main()
