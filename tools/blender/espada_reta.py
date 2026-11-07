"""Deixa uma arma reta (espada, lança) rígida na mão, pela geometria: tudo a menos de `raio` do segmento a→b
(coordenadas do Blender, z para cima) e, se pedido, a menos de `rguarda` do ponto da guarda passa a seguir só o osso.

Uso: Blender -b --factory-startup --python tools/blender/espada_reta.py -- entrada.glb saida.glb \
       --a x,y,z --b x,y,z [--raio 0.09] [--guarda x,y,z --rguarda 0.16] [--osso RightHand]
Serve para armas que cruzam na frente do corpo (o rig mistura a lâmina com as pernas). Mantém as animações.
"""
import argparse, bpy, sys
from mathutils import Vector
v3 = lambda s: Vector(tuple(float(x) for x in s.split(",")))
a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("dst"); a.add_argument("--osso", default="RightHand")
a.add_argument("--a", required=True); a.add_argument("--b", required=True); a.add_argument("--raio", type=float, default=0.09)
a.add_argument("--guarda", default=""); a.add_argument("--rguarda", type=float, default=0.16)
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
A, B = v3(a.a), v3(a.b); G = v3(a.guarda) if a.guarda else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent == arm][0]; mw = o.matrix_world
d = B - A; L2 = d.length_squared
def dist(p):
    t = max(0.0, min(1.0, (p - A).dot(d) / L2)); return (p - (A + d * t)).length
sel = [v.index for v in o.data.vertices if dist(mw @ v.co) < a.raio or (G is not None and ((mw @ v.co) - G).length < a.rguarda)]
print("ESPADA", len(sel), "vértices")
for g in o.vertex_groups: g.remove(sel)
o.vertex_groups[a.osso].add(sel, 1.0, "REPLACE")
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_yup=True)
print("OK", a.dst)
