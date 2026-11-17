#!/usr/bin/env python3
"""Keychain blanks + A3 pressing jig + print template (all mm, y up)."""
import math, sys, os
import numpy as np
import ezdxf
from shapely.geometry import Polygon, Point, box
from shapely import affinity
from shapely.ops import unary_union

OUT = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/outputs"
os.makedirs(OUT, exist_ok=True)

HOLE_D = 4.0      # key-ring hole diameter
KERF = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0   # laser kerf (mm) - measure with a test cut
CLEAR = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0  # real air gap between piece and pocket (mm)
BLEED = 3.0       # print bleed beyond the piece edge
A4W, A4H = 210.0, 297.0
PAGE_W, PAGE_H = 230.0, 317.0   # print page (A4 + 10mm trim margin each side)
M, G = 7.0, 8.0   # frame edge margin, web between pockets

def heart_poly(w, h):
    t = np.linspace(0, 2 * math.pi, 400, endpoint=False)
    x = 16 * np.sin(t) ** 3
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
    p = Polygon(np.c_[x, y])
    minx, miny, maxx, maxy = p.bounds
    p = affinity.scale(p, w / (maxx - minx), h / (maxy - miny), origin=(minx, miny))
    minx, miny, maxx, maxy = p.bounds
    return affinity.translate(p, -(minx + maxx) / 2, -(miny + maxy) / 2)

def heart_hole(poly):
    """hole centre on the vertical axis, under the dip of the heart."""
    minx, miny, maxx, maxy = poly.bounds
    # find dip: topmost point of poly on x=0
    line = box(-0.01, miny - 1, 0.01, maxy + 1).intersection(poly)
    dip_y = line.bounds[3]
    return (0.0, dip_y - (HOLE_D / 2 + 3.5))

def make_shapes():
    S = {}
    # 6x6 heart
    h = heart_poly(60, 60)
    S["לב 6x6"] = (h, heart_hole(h))
    # 5x5 heart
    h5 = heart_poly(50, 50)
    S["לב 5x5"] = (h5, heart_hole(h5))
    # tilted heart 6 x 5.5 : rotate then fit to bbox
    ht = heart_poly(60, 60)
    hc = heart_hole(ht)
    ang = -22
    htr = affinity.rotate(ht, ang, origin=(0, 0))
    hcp = affinity.rotate(Point(hc), ang, origin=(0, 0))
    minx, miny, maxx, maxy = htr.bounds
    sx, sy = 60 / (maxx - minx), 55 / (maxy - miny)
    htr = affinity.scale(htr, sx, sy, origin=(0, 0))
    hcp = affinity.scale(hcp, sx, sy, origin=(0, 0))
    minx, miny, maxx, maxy = htr.bounds
    dx, dy = -(minx + maxx) / 2, -(miny + maxy) / 2
    htr = affinity.translate(htr, dx, dy)
    hcp = affinity.translate(hcp, dx, dy)
    n = math.hypot(hcp.x, hcp.y)
    k = (n - 1.5) / n
    S["לב נטוי 6x5.5"] = (htr, (hcp.x * k, hcp.y * k))
    # rectangle 5x7 (50 wide x 70 tall), rounded corners
    r = box(-25, -35, 25, 35).buffer(-4).buffer(4, resolution=32)
    S["מלבן 5x7"] = (r, (0.0, 35 - (HOLE_D / 2 + 3.5)))
    # circle d=55
    c = Point(0, 0).buffer(27.5, resolution=128)
    S["עיגול 5.5"] = (c, (0.0, 27.5 - (HOLE_D / 2 + 3.5)))
    return S

# S-153: הגאומטריה נלקחת מהסטודיו (studio/index.html: kcGeom) — מקור אחד, כך שהקבצים והכפתורים בלשונית זהים. kc_shapes.json נוצר ע"י dump.py
import json as _json
def _from_studio():
    D = _json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "kc_shapes.json")))
    key = {"לב 6x6": "kc-h6", "לב נטוי 6x5.5": "kc-tilt", "מלבן 5x7": "kc-rect", "עיגול 5.5": "kc-circ", "לב 5x5": "kc-h5"}
    S = {}
    for name, k in key.items():
        d = D[k]; w, h = d["w"], d["h"]
        pts = [(x - w / 2, h / 2 - y) for x, y in d["pts"]]
        hx, hy = d["hole"][0] - w / 2, h / 2 - d["hole"][1]
        S[name] = (Polygon(pts), (hx, hy))
    return S
SHAPES = _from_studio()

ORDER = ["לב 6x6", "לב נטוי 6x5.5", "מלבן 5x7", "עיגול 5.5", "לב 5x5"]
COLS = 4
PITCH = 70.0
GAP_ROW = 14.0

# sanity: hole fully inside with >=3 mm wall
for k, (poly, (hx, hy)) in SHAPES.items():
    hole = Point(hx, hy).buffer(HOLE_D / 2)
    assert poly.contains(hole), k
    wall = poly.exterior.distance(Point(hx, hy)) - HOLE_D / 2
    print(f"{k}: bbox {poly.bounds[2]-poly.bounds[0]:.1f}x{poly.bounds[3]-poly.bounds[1]:.1f} mm, wall around hole {wall:.1f} mm")
    assert wall >= 3.0, (k, wall)


import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import PathPatch, Circle
from matplotlib.path import Path

ORDER = ["לב 6x6", "לב נטוי 6x5.5", "מלבן 5x7", "עיגול 5.5", "לב 5x5"]
ox, oy = (PAGE_W - A4W) / 2, (PAGE_H - A4H) / 2

from ezdxf.math import Matrix44
def save_cm(doc, path):
    m = Matrix44.scale(0.1, 0.1, 0.1)
    for e in doc.modelspace(): e.transform(m)
    doc.saveas(path)

def add_poly(msp, geom, layer):
    msp.add_polyline2d(list(geom.exterior.coords)[:-1], close=True, dxfattribs={"layer": layer})

def new_doc():
    doc = ezdxf.new("R12")
    doc.layers.add("CUT_HOLES", color=1); doc.layers.add("CUT_OUTER", color=5)
    return doc, doc.modelspace()

summary = []
for idx, name in enumerate(ORDER, 1):
    poly, (hx0, hy0) = SHAPES[name]
    minx, miny, maxx, maxy = poly.bounds
    w, h = maxx - minx, maxy - miny
    cols = int((A4W - 2 * M + G) // (w + G)); rows = int((A4H - 2 * M + G) // (h + G))
    pw, ph = cols * w + (cols - 1) * G, rows * h + (rows - 1) * G
    x0, y0 = (A4W - pw) / 2 + w / 2, (A4H - ph) / 2 + h / 2
    cents = [(x0 + c * (w + G), y0 + r * (h + G)) for r in range(rows) for c in range(cols)]
    summary.append((name, cols, rows, len(cents)))
    d = f"{OUT}/{idx}_{name}"; os.makedirs(d, exist_ok=True)

    doc, msp = new_doc()
    for cx, cy in cents:
        add_poly(msp, affinity.translate(poly, cx, cy).buffer(KERF / 2, resolution=32), "CUT_OUTER")
        msp.add_circle((hx0 + cx, hy0 + cy), HOLE_D / 2 - KERF / 2, dxfattribs={"layer": "CUT_HOLES"})
    save_cm(doc, f"{d}/1_חיתוך_חלקים_CM.dxf")

    doc, msp = new_doc()
    msp.add_polyline2d([(0, 0), (A4W, 0), (A4W, A4H), (0, A4H)], close=True, dxfattribs={"layer": "CUT_OUTER"})
    for cx, cy in cents:
        add_poly(msp, affinity.translate(poly, cx, cy).buffer(CLEAR - KERF / 2, resolution=32), "CUT_HOLES")
    save_cm(doc, f"{d}/2_שבלונה_מסגרת_A4_CM.dxf")

    doc, msp = new_doc()
    msp.add_polyline2d([(0, 0), (A4W, 0), (A4W, A4H), (0, A4H)], close=True, dxfattribs={"layer": "CUT_OUTER"})
    save_cm(doc, f"{d}/3_שבלונה_בסיס_A4_CM.dxf")

    def draw(ax):
        ax.set_xlim(0, PAGE_W); ax.set_ylim(0, PAGE_H); ax.set_aspect("equal"); ax.axis("off")
        for cx, cy in cents:
            p = affinity.translate(poly, cx, cy)
            ax.add_patch(PathPatch(Path(np.array(p.buffer(BLEED, resolution=32).exterior.coords) + [ox, oy]), fill=False, ec="#00a0c8", lw=0.5, ls=(0, (3, 2))))
            ax.add_patch(PathPatch(Path(np.array(p.exterior.coords) + [ox, oy]), fill=False, ec="#e0007a", lw=0.7))
            ax.add_patch(Circle((hx0 + cx + ox, hy0 + cy + oy), HOLE_D / 2, fill=False, ec="#e0007a", lw=0.7))
        for (x, y) in [(ox, oy), (ox + A4W, oy), (ox, oy + A4H), (ox + A4W, oy + A4H)]:
            sx = -1 if x == ox else 1; sy = -1 if y == oy else 1
            ax.plot([x + sx * 2, x + sx * 9], [y, y], "k", lw=0.8)
            ax.plot([x, x], [y + sy * 2, y + sy * 9], "k", lw=0.8)

    fig = plt.figure(figsize=(PAGE_W / 25.4, PAGE_H / 25.4), dpi=300)
    ax = fig.add_axes([0, 0, 1, 1]); draw(ax)
    fig.savefig(f"{d}/4_תבנית_הדפסה_A4.png", dpi=300, facecolor="white"); plt.close(fig)

    fig = plt.figure(figsize=(3.2, 3.2 * PAGE_H / PAGE_W), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1]); draw(ax)
    ax.add_patch(plt.Rectangle((ox, oy), A4W, A4H, fill=False, ec="gray", lw=0.4))
    fig.savefig(f"/home/claude/work/prev_{idx}.png", dpi=100, facecolor="white"); plt.close(fig)

for s in summary: print(s)
