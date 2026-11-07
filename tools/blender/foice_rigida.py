"""Deixa uma arma longa (foice, cajado) rígida na mão, pela geometria e não pelos pesos do rig.

Uso: Blender -b --factory-startup --python tools/blender/foice_rigida.py -- entrada.glb saida.glb \
       [--osso LeftHand] [--ymax -0.38] [--zmin 1.95] [--raio 0.07] [--yhaste -0.28]
A malha do Meshy é uma peça só: a lâmina e a parte de cima do cabo ficam num plano à frente do corpo (y < ymax, z > zmin);
o resto do cabo, abaixo da mão, é achado por uma reta ajustada aos vértices da frente (y < yhaste) do lado da mão, e entra
tudo o que está a menos de `raio` dela. Todos passam a seguir só o osso da mão (peso 1). Mantém as animações.
"""
import argparse, bpy, sys
from mathutils import Vector
a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("dst")
a.add_argument("--osso", default="LeftHand"); a.add_argument("--ymax", type=float, default=-0.38)
a.add_argument("--zmin", type=float, default=1.95); a.add_argument("--raio", type=float, default=0.07)
a.add_argument("--yhaste", type=float, default=-0.28)
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent == arm][0]
mw = o.matrix_world; g = o.vertex_groups[a.osso]
mao = arm.matrix_world @ arm.data.bones[a.osso].head_local
lado = 1 if mao.x > 0 else -1
P = [mw @ v.co for v in o.data.vertices]
topo = [i for i, p in enumerate(P) if p.y < a.ymax and p.z > a.zmin]
# reta do cabo: média dos vértices da frente, do lado da mão, abaixo dela, em fatias de altura
pts = []
for k in range(19):
    z0 = k * 0.1
    S = [p for p in P if z0 <= p.z < z0 + 0.1 and p.y < a.yhaste and p.x * lado > 0.08 and p.z < a.zmin]
    if len(S) >= 3: pts.append(sum(S, Vector()) / len(S))
pts.append(Vector(mao))
n = len(pts); c = sum(pts, Vector()) / n
# direção principal (iteração de potência na covariância)
d = Vector((0, 0, 1))
for _ in range(30):
    nd = Vector()
    for p in pts: q = p - c; nd += q * q.dot(d)
    d = nd.normalized()
haste = []
for i, p in enumerate(P):
    if p.z >= a.zmin or p.y > a.yhaste + 0.12: continue
    q = p - c; dist = (q - d * q.dot(d)).length
    if dist < a.raio: haste.append(i)
sel = sorted(set(topo) | set(haste))
print("FOICE topo", len(topo), "haste", len(haste), "total", len(sel), "reta", [round(x, 3) for x in c], [round(x, 3) for x in d])
for vg in o.vertex_groups: vg.remove(sel)
g.add(sel, 1.0, "REPLACE")
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_yup=True)
print("OK", a.dst)
