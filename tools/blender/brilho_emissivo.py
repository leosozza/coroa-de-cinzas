"""Copia o mapa de brilho (emissive) de um GLB para outro com o mesmo atlas de UV, mantendo esqueleto e animações.
Uso: Blender -b --factory-startup --python tools/blender/brilho_emissivo.py -- com_brilho.glb destino.glb saida.glb [--forca 2.0]
"""
import argparse, bpy, sys
a = argparse.ArgumentParser(); a.add_argument("fonte"); a.add_argument("dst"); a.add_argument("out"); a.add_argument("--forca", type=float, default=2.0)
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.fonte)
img = None
for m in bpy.data.materials:
    if not m.use_nodes: continue
    b = m.node_tree.nodes.get("Principled BSDF")
    if b and b.inputs["Emission Color"].is_linked:
        img = b.inputs["Emission Color"].links[0].from_node.image
img.pack(); img.name = "brilho_brasas"
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
bpy.ops.import_scene.gltf(filepath=a.dst)
n = 0
for o in bpy.data.objects:
    if o.type != "MESH": continue
    for m in o.data.materials:
        nt = m.node_tree; b = nt.nodes["Principled BSDF"]
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
        nt.links.new(t.outputs["Color"], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = a.forca; n += 1
print("BRILHO aplicado em", n, "materiais")
bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS",
                          export_image_format="AUTO", export_yup=True)
print("OK", a.out)
