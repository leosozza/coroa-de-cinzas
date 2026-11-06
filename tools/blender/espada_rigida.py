"""Deixa a espada rígida na mão: todo vértice abaixo do punho que a mão puxa passa a seguir só a mão.

Uso: Blender -b --factory-startup --python tools/blender/espada_rigida.py -- entrada.glb saida.glb [--osso RightHand]
Corrige a lâmina que entorta (pesos divididos entre mão e antebraço). Mantém as animações.
"""
import argparse, bpy, sys, collections
a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("dst"); a.add_argument("--osso", default="RightHand")
a.add_argument("--min", type=float, default=0.05, help="peso mínimo da mão para o vértice contar como espada")
a.add_argument("--zacima", type=float, default=-0.03, help="até quanto acima da mão entra (escudo, chama): padrão só abaixo")
a.add_argument("--raio", type=float, default=0.0, help="se > 0, só vértices até essa distância da mão (esfera, chama)")
a.add_argument("--xoff", type=float, default=-0.02, help="quanto além do x da mão começa a seleção (negativo: um pouco antes)")
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent == arm][0]
mw = o.matrix_world; g = o.vertex_groups[a.osso]
mao = arm.matrix_world @ arm.data.bones[a.osso].head_local
lado = 1 if mao.x > 0 else -1
sel, antes = [], collections.Counter()
for v in o.data.vertices:
    p = mw @ v.co
    w = next((x.weight for x in v.groups if x.group == g.index), 0.0)
    if w >= a.min and p.z < mao.z + a.zacima and p.x * lado > abs(mao.x) + a.xoff and (a.raio <= 0 or (p - mao).length < a.raio):
        sel.append(v.index); antes["misturado" if w < 0.99 else "só mão"] += 1
print("ESPADA", len(sel), "vértices", dict(antes))
for vg in o.vertex_groups: vg.remove(sel)
g.add(sel, 1.0, "REPLACE")
for x in list(bpy.data.objects):
    if x.type == "MESH" and x.parent is None and x.name.startswith("Icosphere"): bpy.data.objects.remove(x)
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_yup=True)
print("OK", a.dst)
