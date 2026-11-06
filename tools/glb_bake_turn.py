#!/usr/bin/env python3
"""Gira um GLB (sem skin) em torno de Y e aplica escala, gravando nos vértices: para o modelo olhar para +Z.
Uso: python3 tools/glb_bake_turn.py entrada.glb saida.glb --graus -90 --altura 1.6
"""
import argparse, json, math, struct

ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--graus", type=float, default=-90); ap.add_argument("--altura", type=float, default=0)
a = ap.parse_args()
b = open(a.src, "rb").read(); assert b[:4] == b"glTF"
o = 12; chunks = []
while o < len(b):
    ln, typ = struct.unpack("<I4s", b[o:o+8]); chunks.append([typ, bytearray(b[o+8:o+8+ln])]); o += 8 + ln
j = json.loads(chunks[0][1]); binc = chunks[1][1]
assert not j.get("skins"), "modelo com skin: use o modelo base"
th = math.radians(a.graus); c, s = math.cos(th), math.sin(th)
rot = lambda x, y, z: (c*x + s*z, y, -s*x + c*z)
# altura atual (antes) para a escala
pos_acc = {pr["attributes"]["POSITION"] for m in j["meshes"] for pr in m["primitives"]}
ymin = min(j["accessors"][i]["min"][1] for i in pos_acc); ymax = max(j["accessors"][i]["max"][1] for i in pos_acc)
k = (a.altura / (ymax - ymin)) if a.altura else 1.0
def each(acc_i, fn):
    acc = j["accessors"][acc_i]; bv = j["bufferViews"][acc["bufferView"]]
    assert acc["componentType"] == 5126 and acc["type"] == "VEC3"
    stride = bv.get("byteStride", 12); base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    mn = [1e9]*3; mx = [-1e9]*3
    for n in range(acc["count"]):
        p = base + n*stride; v = fn(*struct.unpack_from("<3f", binc, p)); struct.pack_into("<3f", binc, p, *v)
        mn = [min(mn[i], v[i]) for i in range(3)]; mx = [max(mx[i], v[i]) for i in range(3)]
    if "min" in acc: acc["min"], acc["max"] = mn, mx
nrm_acc = {pr["attributes"]["NORMAL"] for m in j["meshes"] for pr in m["primitives"] if "NORMAL" in pr["attributes"]}
for i in pos_acc: each(i, lambda x, y, z: tuple(t*k for t in rot(x, y - ymin, z)))
for i in nrm_acc: each(i, rot)
for n in j.get("nodes", []):
    assert not any(t in n for t in ("rotation", "matrix")) or n.get("mesh") is None, "nó com transformação: confira"
js = json.dumps(j, separators=(",", ":")).encode(); js += b" " * ((4 - len(js) % 4) % 4)
binc += b"\0" * ((4 - len(binc) % 4) % 4)
out = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(binc)) + struct.pack("<I4s", len(js), b"JSON") + js + struct.pack("<I4s", len(binc), b"BIN\0") + bytes(binc)
open(a.dst, "wb").write(out)
print(f"ok: girado {a.graus}°, escala {k:.3f}, altura {(ymax-ymin)*k:.2f} m -> {a.dst}")
