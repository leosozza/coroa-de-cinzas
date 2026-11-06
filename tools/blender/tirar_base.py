"""Remove a base redonda (pedestal) grudada aos pés: apaga vértices baixos longe dos ossos dos pés. Mantém as animações.
Uso: Blender -b --factory-startup --python tools/blender/tirar_base.py -- entrada.glb saida.glb [--altura 0.045] [--raio 0.13]
"""
import argparse, bpy, bmesh, sys
from mathutils import Vector
a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("dst")
a.add_argument("--altura", type=float, default=0.045); a.add_argument("--raio", type=float, default=0.13)
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent == arm][0]; mw = o.matrix_world
pes = [arm.matrix_world @ b.head_local for b in arm.data.bones if b.name in ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")]
bm = bmesh.new(); bm.from_mesh(o.data)
def perto(p): return min(((p.x - q.x) ** 2 + (p.y - q.y) ** 2) ** 0.5 for q in pes) < a.raio
mata = [v for v in bm.verts if (mw @ v.co).z < a.altura and not perto(mw @ v.co)]
print("BASE", len(mata), "vértices removidos")
bmesh.ops.delete(bm, geom=mata, context="VERTS"); bm.to_mesh(o.data); bm.free()
for x in list(bpy.data.objects):
    if x.type == "MESH" and x.parent is None and x.name.startswith("Icosphere"): bpy.data.objects.remove(x)
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS", export_image_format="AUTO", export_yup=True)
print("OK", a.dst)
