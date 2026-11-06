"""Gira e escala um GLB (com ou sem esqueleto e animações) para o padrão do jogo: frente para -Y do Blender (+Z do glTF), altura em metros.
Uso: Blender -b --factory-startup --python tools/blender/orientar.py -- entrada.glb saida.glb --graus -90 --altura 1.6
"""
import argparse, bpy, sys, math
from mathutils import Matrix
a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("dst"); a.add_argument("--graus", type=float, default=-90); a.add_argument("--altura", type=float, default=1.6)
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
for x in list(bpy.data.objects):
    if x.type == "MESH" and x.parent is None and x.name.startswith("Icosphere"): bpy.data.objects.remove(x)
raizes = [o for o in bpy.data.objects if o.parent is None]
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.context.view_layer.update()
zs = [(o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices]
h = max(zs) - min(zs); k = a.altura / h
R = Matrix.Rotation(math.radians(a.graus), 4, "Z") @ Matrix.Scale(k, 4)
for o in raizes: o.matrix_world = R @ o.matrix_world
bpy.context.view_layer.update()
for o in bpy.data.objects: o.select_set(True)
bpy.context.view_layer.objects.active = raizes[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
print("ORIENT altura", round(h, 3), "-> escala", round(k, 3), "| objetos", [o.name for o in raizes])
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS", export_image_format="AUTO", export_yup=True)
print("OK", a.dst)
