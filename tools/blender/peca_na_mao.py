"""Leva uma peça solta da malha (cajado, arma) até a mão e a prende rígida ao osso, mantendo as animações.

Uso: Blender -b --factory-startup --python tools/blender/peca_na_mao.py -- entrada.glb saida.glb \
       --osso RightHand --lado -1 [--avanco 0.05]
Escolhe a maior ilha solta (que não seja o corpo) do lado indicado (-1: direita do personagem, x<0).
Só desloca na horizontal: o eixo da peça passa pelo centro da mão e a altura fica a mesma.
"""
import argparse, bpy, sys
from mathutils import Vector
a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("dst")
a.add_argument("--osso", default="RightHand"); a.add_argument("--lado", type=int, default=-1); a.add_argument("--avanco", type=float, default=0.05)
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent == arm][0]
mw = o.matrix_world; inv = mw.inverted(); me = o.data
pos = [mw @ v.co for v in me.vertices]
pai = list(range(len(pos)))
def f(i):
    while pai[i] != i: pai[i] = pai[pai[i]]; i = pai[i]
    return i
vis = {}
for i, p in enumerate(pos):
    k = (round(p.x, 4), round(p.y, 4), round(p.z, 4))
    if k in vis: pai[f(i)] = f(vis[k])
    else: vis[k] = i
for e in me.edges:
    x, y = f(e.vertices[0]), f(e.vertices[1])
    if x != y: pai[x] = y
ilhas = {}
for i in range(len(pos)): ilhas.setdefault(f(i), []).append(i)
cands = [v for v in ilhas.values() if len(v) < len(pos) * 0.5 and (sum(pos[i].x for i in v) / len(v)) * a.lado > 0.2]
peca = max(cands, key=len)
c = sum((pos[i] for i in peca), Vector()) / len(peca)
fa = arm.matrix_world @ arm.data.bones[a.osso.replace("Hand", "ForeArm")].head_local
hd = arm.matrix_world @ arm.data.bones[a.osso].head_local
mao = hd + (hd - fa).normalized() * a.avanco
delta = Vector((mao.x - c.x, mao.y - c.y, 0))
for i in peca: me.vertices[i].co = inv @ (pos[i] + delta)
for g in o.vertex_groups: g.remove(peca)
o.vertex_groups[a.osso].add(peca, 1.0, "REPLACE"); me.update()
print("PECA", len(peca), "vértices; centro", [round(x, 3) for x in c], "-> deslocada", [round(x, 3) for x in delta])
for x in list(bpy.data.objects):
    if x.type == "MESH" and x.parent is None and x.name.startswith("Icosphere"): bpy.data.objects.remove(x)
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS",
                          export_image_format="AUTO", export_yup=True)
print("OK", a.dst)
