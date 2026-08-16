#!/usr/bin/env python3
"""Generate the fixture CAD files described in PLAN.md section 10.

Every mesh here is constructed analytically so its exact metrics are known,
which is what makes fixtures/README.md a trustworthy ground-truth table.
"""
import math
import struct
from pathlib import Path

OUT = Path("/Users/samhithsripada/repos/vector-vault/fixtures")
OUT.mkdir(parents=True, exist_ok=True)


def tri_normal(a, b, c):
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    ln = math.sqrt(nx * nx + ny * ny + nz * nz)
    return (0.0, 0.0, 0.0) if ln == 0 else (nx / ln, ny / ln, nz / ln)


def write_binary_stl(path, tris, header=b""):
    """header: first 80 bytes. Deliberately settable to test the 'solid' trap."""
    h = header[:80].ljust(80, b"\0")
    with open(path, "wb") as f:
        f.write(h)
        f.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            n = tri_normal(a, b, c)
            f.write(struct.pack("<12fH", *n, *a, *b, *c, 0))


def write_ascii_stl(path, tris, name="mesh"):
    with open(path, "w") as f:
        f.write(f"solid {name}\n")
        for a, b, c in tris:
            n = tri_normal(a, b, c)
            f.write(f"  facet normal {n[0]:.6e} {n[1]:.6e} {n[2]:.6e}\n")
            f.write("    outer loop\n")
            for v in (a, b, c):
                f.write(f"      vertex {v[0]:.6e} {v[1]:.6e} {v[2]:.6e}\n")
            f.write("    endloop\n  endfacet\n")
        f.write(f"endsolid {name}\n")


def box_faces(sx, sy, sz, ox=0.0, oy=0.0, oz=0.0):
    """Axis-aligned box corners, CCW seen from outside. Returns 6 quads."""
    x0, y0, z0 = ox, oy, oz
    x1, y1, z1 = ox + sx, oy + sy, oz + sz
    v = {
        "000": (x0, y0, z0), "100": (x1, y0, z0), "110": (x1, y1, z0), "010": (x0, y1, z0),
        "001": (x0, y0, z1), "101": (x1, y0, z1), "111": (x1, y1, z1), "011": (x0, y1, z1),
    }
    return [
        ("bottom", [v["000"], v["010"], v["110"], v["100"]]),  # -Z
        ("top",    [v["001"], v["101"], v["111"], v["011"]]),  # +Z
        ("front",  [v["000"], v["100"], v["101"], v["001"]]),  # -Y
        ("back",   [v["110"], v["010"], v["011"], v["111"]]),  # +Y
        ("left",   [v["000"], v["001"], v["011"], v["010"]]),  # -X
        ("right",  [v["100"], v["110"], v["111"], v["101"]]),  # +X
    ]


def quad_to_tris(q):
    return [(q[0], q[1], q[2]), (q[0], q[2], q[3])]


def subdivide_quad(q, n):
    """Split a planar quad into an n x n grid of quads, preserving winding."""
    def lerp(p, r, t):
        return tuple(p[i] + (r[i] - p[i]) * t for i in range(3))
    out = []
    for i in range(n):
        for j in range(n):
            u0, u1 = i / n, (i + 1) / n
            w0, w1 = j / n, (j + 1) / n
            # bilinear across the quad q0->q1 (u) and q0->q3 (w)
            def pt(u, w):
                a = lerp(q[0], q[1], u)
                b = lerp(q[3], q[2], u)
                return lerp(a, b, w)
            out.append([pt(u0, w0), pt(u1, w0), pt(u1, w1), pt(u0, w1)])
    return out


def box_tris(sx, sy, sz, subdiv=1, skip=()):
    tris = []
    for name, quad in box_faces(sx, sy, sz):
        if name in skip:
            continue
        quads = [quad] if subdiv == 1 else subdivide_quad(quad, subdiv)
        for q in quads:
            tris.extend(quad_to_tris(q))
    return tris


# --- 1. cube-20mm.stl -------------------------------------------------------
# Binary, but the 80-byte header STARTS WITH "solid" on purpose: a parser that
# sniffs the ASCII prefix instead of doing the byte-length arithmetic in
# ARCHITECTURE.md section 7 will misread this file. That is the point.
cube = box_tris(20, 20, 20)
write_binary_stl(OUT / "cube-20mm.stl", cube, header=b"solid cube-20mm binary-with-ascii-prefix TRAP")

# --- 2. cube-20mm-ascii.stl -------------------------------------------------
write_ascii_stl(OUT / "cube-20mm-ascii.stl", cube, name="cube-20mm")

# --- 3. cube-20mm-refined.stl ----------------------------------------------
# Identical geometry, 4x4 subdivision per face. Different bytes, different
# triangle count, IDENTICAL volume and surface area. This is the C6 anchor.
write_binary_stl(OUT / "cube-20mm-refined.stl", box_tris(20, 20, 20, subdiv=4),
                 header=b"cube-20mm refined tessellation")

# --- 4. open-shell.stl ------------------------------------------------------
# Cube missing its top face: 10 triangles, NOT watertight. Volume must be null.
write_binary_stl(OUT / "open-shell.stl", box_tris(20, 20, 20, skip=("top",)),
                 header=b"open shell - non-watertight")

# --- 5/6. bracket-v1 / bracket-v2 ------------------------------------------
# A real, legible change: the plate gets thinner, 12mm -> 10mm.
write_binary_stl(OUT / "bracket-v1.stl", box_tris(80, 40, 12), header=b"bracket v1")
write_binary_stl(OUT / "bracket-v2.stl", box_tris(80, 40, 10), header=b"bracket v2")

# --- 7. large.stl -----------------------------------------------------------
# UV sphere, r=50mm. ~45 MiB: large enough to exercise the direct-to-Storage
# upload path and the Web Worker, but under the Supabase free-plan 50 MiB
# per-object ceiling (verified live: the bucket cannot be raised above it).
LAT, LON, R = 500, 945, 50.0
def sph(i, j):
    theta = math.pi * i / LAT
    phi = 2 * math.pi * j / LON
    return (R * math.sin(theta) * math.cos(phi),
            R * math.sin(theta) * math.sin(phi),
            R * math.cos(theta))

with open(OUT / "large.stl", "wb") as f:
    f.write(b"large sphere fixture".ljust(80, b"\0"))
    count_pos = f.tell()
    f.write(struct.pack("<I", 0))  # patched below
    n = 0
    buf = bytearray()
    # At the poles the quad collapses to a triangle (a==b at the north pole,
    # c==d at the south), so emit one triangle there instead of two degenerates.
    for i in range(LAT):
        for j in range(LON):
            a, b, c, d = sph(i, j), sph(i, j + 1), sph(i + 1, j + 1), sph(i + 1, j)
            if i == 0:
                tris = [(a, c, d)]
            elif i == LAT - 1:
                tris = [(a, b, c)]
            else:
                tris = [(a, b, c), (a, c, d)]
            for t in tris:
                nm = tri_normal(*t)
                buf += struct.pack("<12fH", *nm, *t[0], *t[1], *t[2], 0)
                n += 1
        if len(buf) > 4_000_000:
            f.write(buf); buf = bytearray()
    f.write(buf)
    f.seek(count_pos)
    f.write(struct.pack("<I", n))

# --- 8. part.step -----------------------------------------------------------
# Minimal syntactically valid STEP AP203 file. Exercises the unparseable path:
# it must store, version and share, but never render.
step = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Vector Vault fixture - unparseable-format path'),'2;1');
FILE_NAME('part.step','2026-08-15T00:00:00',('fixtures'),(''),'','','');
FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));
ENDSEC;
DATA;
#1=CARTESIAN_POINT('',(0.,0.,0.));
#2=DIRECTION('',(0.,0.,1.));
#3=DIRECTION('',(1.,0.,0.));
#4=AXIS2_PLACEMENT_3D('',#1,#2,#3);
#5=MANIFOLD_SOLID_BREP('part',#4);
ENDSEC;
END-ISO-10303-21;
"""
(OUT / "part.step").write_text(step)

# --- 9. part.sldprt ---------------------------------------------------------
# Opaque proprietary blob. Only the degradation path cares about its contents.
(OUT / "part.sldprt").write_bytes(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + bytes(2048))

print("done")
