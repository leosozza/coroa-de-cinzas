"""Leva o escudo (ilha solta da malha, caído junto à canela) para o antebraço esquerdo e o prende a ele.

Uso: Blender -b --factory-startup --python tools/blender/escudo_no_braco.py -- entrada.glb saida.glb [--osso LeftForeArm]
Mantém as animações. O escudo fica rígido no osso (não entorta) e com a face para a frente na pose de repouso.
"""
import argparse, bpy, bmesh, sys
from mathutils import Vector, Matrix
a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("dst"); a.add_argument("--osso", default="LeftForeArm")
a.add_argument("--frente", type=float, default=0.07, help="distância do centro do escudo ao eixo do braço (m)")
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent == arm][0]
mw = o.matrix_world; inv = mw.inverted()
# ilhas pela posição (os vértices duplicados de costura são unidos só para achar as ilhas)
me = o.data; pos = [mw @ v.co for v in me.vertices]
key = lambda p: (round(p.x, 4), round(p.y, 4), round(p.z, 4))
grupo = {}; pai = list(range(len(pos)))
def f(i):
    while pai[i] != i: pai[i] = pai[pai[i]]; i = pai[i]
    return i
for i, p in enumerate(pos):
    k = key(p)
    if k in grupo: pai[f(i)] = f(grupo[k])
    else: grupo[k] = i
for e in me.edges:
    x, y = f(e.vertices[0]), f(e.vertices[1])
    if x != y: pai[x] = y
ilhas = {}
for i in range(len(pos)): ilhas.setdefault(f(i), []).append(i)
cands = [v for v in ilhas.values() if len(v) < len(pos) * 0.5]
def centro(idx): return sum((pos[i] for i in idx), Vector()) / len(idx)
esc = max(cands, key=len)
c0 = centro(esc)
print("ESCUDO", len(esc), "vértices, centro", [round(x, 3) for x in c0])
# normal do disco = menor eixo (PCA simples)
import numpy as np
P = np.array([[pos[i].x, pos[i].y, pos[i].z] for i in esc]) - np.array(c0)
w, V = np.linalg.eigh(P.T @ P); n0 = Vector(V[:, 0]).normalized()
if n0.y > 0: n0 = -n0                                   # face voltada para a frente (-Y)
fa = arm.matrix_world @ arm.data.bones[a.osso].head_local
hd = arm.matrix_world @ arm.data.bones["LeftHand"].head_local
d = (hd - fa).normalized(); meio = fa + (hd - fa) * 0.55
frente = Vector((0, -1, 0)); n1 = (frente - frente.dot(d) * d).normalized()
R = n0.rotation_difference(n1).to_matrix().to_4x4()
alvo = meio + n1 * a.frente
T = Matrix.Translation(alvo) @ R @ Matrix.Translation(-c0)
for i in esc: me.vertices[i].co = inv @ (T @ pos[i])
for vn in me.vertices: pass
g = o.vertex_groups[a.osso]
for vg in o.vertex_groups: vg.remove(esc)
g.add(esc, 1.0, "REPLACE")
me.update()
print("ESCUDO novo centro", [round(x, 3) for x in alvo], "normal", [round(x, 2) for x in n1])
for x in list(bpy.data.objects):
    if x.type == "MESH" and x.parent is None and x.name.startswith("Icosphere"): bpy.data.objects.remove(x)
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_yup=True)
print("OK", a.dst)
