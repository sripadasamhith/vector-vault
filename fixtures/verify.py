#!/usr/bin/env python3
"""Read the fixtures back and compute metrics independently of the generator.

This is deliberately a second implementation: it parses the written bytes
rather than reusing the in-memory triangles, so it validates the files.
"""
import math
import struct
from pathlib import Path

OUT = Path("/Users/samhithsripada/repos/vector-vault/fixtures")


def detect_and_parse(path):
    data = path.read_bytes()
    if len(data) >= 84:
        count = struct.unpack("<I", data[80:84])[0]
        if 84 + 50 * count == len(data):
            tris = []
            for k in range(count):
                o = 84 + 50 * k
                f = struct.unpack("<12f", data[o:o + 48])
                tris.append((f[3:6], f[6:9], f[9:12]))
            return "binary", tris
    txt = data.decode("utf-8", errors="replace")
    verts, tris = [], []
    for line in txt.splitlines():
        s = line.strip()
        if s.startswith("vertex "):
            verts.append(tuple(float(x) for x in s.split()[1:4]))
            if len(verts) == 3:
                tris.append(tuple(verts)); verts = []
    return "ascii", tris


def metrics(tris):
    vol6 = 0.0
    area = 0.0
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    edges = {}
    for a, b, c in tris:
        vol6 += (a[0] * (b[1] * c[2] - b[2] * c[1])
                 - a[1] * (b[0] * c[2] - b[2] * c[0])
                 + a[2] * (b[0] * c[1] - b[1] * c[0]))
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        cx, cy, cz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
        area += 0.5 * math.sqrt(cx * cx + cy * cy + cz * cz)
        for v in (a, b, c):
            for i in range(3):
                lo[i] = min(lo[i], v[i]); hi[i] = max(hi[i], v[i])
        q = lambda v: tuple(round(x, 6) + 0.0 for x in v)
        for p, r in ((a, b), (b, c), (c, a)):
            key = tuple(sorted([q(p), q(r)]))
            edges[key] = edges.get(key, 0) + 1
    watertight = bool(edges) and all(v == 2 for v in edges.values())
    return {
        "tris": len(tris),
        "volume": abs(vol6) / 6.0 if watertight else None,
        "area": area,
        "bbox": [round(hi[i] - lo[i], 4) for i in range(3)],
        "watertight": watertight,
    }


rows = []
for name in ["cube-20mm.stl", "cube-20mm-ascii.stl", "cube-20mm-refined.stl",
             "open-shell.stl", "bracket-v1.stl", "bracket-v2.stl", "large.stl"]:
    p = OUT / name
    enc, tris = detect_and_parse(p)
    m = metrics(tris)
    vol = f"{m['volume']:.4f}" if m["volume"] is not None else "null"
    rows.append((name, enc, m["tris"], vol, f"{m['area']:.4f}",
                 "x".join(str(d) for d in m["bbox"]), str(m["watertight"]),
                 f"{p.stat().st_size:,}"))

w = [max(len(str(r[i])) for r in rows + [("file", "enc", "tris", "volume mm3",
     "area mm2", "bbox mm", "watertight", "bytes")]) for i in range(8)]
hdr = ("file", "enc", "tris", "volume mm3", "area mm2", "bbox mm", "watertight", "bytes")
print(" | ".join(h.ljust(w[i]) for i, h in enumerate(hdr)))
print("-+-".join("-" * w[i] for i in range(8)))
for r in rows:
    print(" | ".join(str(c).ljust(w[i]) for i, c in enumerate(r)))

print()
# The assertions that actually matter.
enc, t = detect_and_parse(OUT / "cube-20mm.stl"); m = metrics(t)
assert enc == "binary", "cube-20mm.stl must be BINARY despite its 'solid' header"
assert abs(m["volume"] - 8000.0) < 8000 * 0.001, m["volume"]
assert abs(m["area"] - 2400.0) < 2400 * 0.001, m["area"]
assert m["watertight"]
print("OK  cube-20mm.stl  binary-with-solid-header, volume 8000, area 2400, watertight")

_, t2 = detect_and_parse(OUT / "cube-20mm-refined.stl"); m2 = metrics(t2)
assert m2["tris"] != m["tris"]
assert abs(m2["volume"] - m["volume"]) < 1e-6 and abs(m2["area"] - m["area"]) < 1e-6
assert (OUT / "cube-20mm.stl").read_bytes() != (OUT / "cube-20mm-refined.stl").read_bytes()
print("OK  C6 anchor: refined cube has different bytes and triangle count, identical volume/area")

_, t3 = detect_and_parse(OUT / "open-shell.stl"); m3 = metrics(t3)
assert m3["watertight"] is False and m3["volume"] is None
print("OK  open-shell.stl  not watertight, volume null")

enc4, t4 = detect_and_parse(OUT / "cube-20mm-ascii.stl"); m4 = metrics(t4)
assert enc4 == "ascii" and abs(m4["volume"] - 8000.0) < 1.0
print("OK  cube-20mm-ascii.stl  parses as ascii, same geometry")

_, t5 = detect_and_parse(OUT / "bracket-v1.stl"); m5 = metrics(t5)
_, t6 = detect_and_parse(OUT / "bracket-v2.stl"); m6 = metrics(t6)
assert abs(m5["volume"] - 38400) < 1 and abs(m6["volume"] - 32000) < 1
print(f"OK  bracket v1->v2  volume {m5['volume']:.0f} -> {m6['volume']:.0f} mm3 "
      f"({(m6['volume']/m5['volume']-1)*100:.2f}%)")

sz = (OUT / "large.stl").stat().st_size
assert 40 * 1024 * 1024 < sz < 50 * 1024 * 1024, sz
print(f"OK  large.stl  {sz/1048576:.1f} MiB (>40, under the 50 MiB Supabase free-plan cap)")
