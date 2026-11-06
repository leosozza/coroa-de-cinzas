"""Prende as asas (atrás do tronco) ao osso das costas, para não esticarem com os braços. Mantém as animações.
Uso: Blender -b --factory-startup --python tools/blender/asas_rigidas.py -- entrada.glb saida.glb [--osso Spine02] [--atras 0.17] [--zmin 0.3] [--longe 0.22]
Pega vértices atrás das costas (y > y do osso + atras), acima de zmin (fração da altura) e longe das mãos.
"""
import argparse, bpy, sys
a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("dst"); a.add_argument("--osso", default="Spine02")
a.add_argument("--atras", type=float, default=0.17); a.add_argument("--zmin", type=float, default=0.3); a.add_argument("--longe", type=float, default=0.22)
a.add_argument("--pular", default="", help="ossos (vírgula) cujos vértices já presos 100%% não entram (ex.: L_Hand com a esfera de fogo)")
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent == arm][0]; mw = o.matrix_world
amw = arm.matrix_world; esp = amw @ arm.data.bones[a.osso].head_local
maos = [amw @ b.head_local for b in arm.data.bones if b.name in ("L_Hand", "R_Hand", "LeftHand", "RightHand")]
zs = [(mw @ v.co).z for v in o.data.vertices]; alt = max(zs) - min(zs)
pular = {o.vertex_groups[n].index for n in a.pular.split(",") if n and n in o.vertex_groups}
sel = []
for v in o.data.vertices:
    p = mw @ v.co
    if any(g.group in pular and g.weight >= 0.99 for g in v.groups): continue
    if p.y > esp.y + a.atras and p.z > min(zs) + a.zmin * alt and all((p - m).length > a.longe for m in maos):
        sel.append(v.index)
for g in o.vertex_groups: g.remove(sel)
o.vertex_groups[a.osso].add(sel, 1.0, "REPLACE")
print("ASAS", len(sel), "vértices presos a", a.osso)
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS", export_image_format="AUTO", export_yup=True)
print("OK", a.dst)
