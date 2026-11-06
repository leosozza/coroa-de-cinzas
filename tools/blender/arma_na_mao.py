"""Prende a arma ao osso da mão e a separa como parte própria ("Espada"), mantendo as animações.

Uso: Blender -b --factory-startup --python tools/blender/arma_na_mao.py -- entrada.glb saida.glb \
       --osso LeftHand --xmin 0.19 --zmin 0.15 --zcorte 0.78 --zmax 0.98 --nome Espada
Região (metros, pose de repouso, vista de frente): x > xmin e zmin < z < zmax.
Abaixo de zcorte entra tudo (lâmina); entre zcorte e zmax só o que estava preso às pernas (cabo/guarda).
"""
import argparse, bpy, sys
a = argparse.ArgumentParser()
a.add_argument("src"); a.add_argument("dst"); a.add_argument("--osso", default="LeftHand")
a.add_argument("--xmin", type=float, default=0.19); a.add_argument("--zmin", type=float, default=0.15)
a.add_argument("--zcorte", type=float, default=0.78); a.add_argument("--zmax", type=float, default=0.98)
a.add_argument("--nome", default="Espada")
a = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]
mw = o.matrix_world; names = {g.index: g.name for g in o.vertex_groups}
hand = o.vertex_groups[a.osso]; pernas = {"LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg", "Hips"}
sel = []
for v in o.data.vertices:
    p = mw @ v.co
    if p.x <= a.xmin or not (a.zmin < p.z < a.zmax):
        continue
    dom = max(v.groups, key=lambda g: g.weight, default=None)
    if p.z < a.zcorte or (dom and names[dom.group] in pernas):
        sel.append(v.index)
print("ARMA", len(sel), "vértices presos a", a.osso)
for g in o.vertex_groups:
    g.remove(sel)
hand.add(sel, 1.0, "REPLACE")
# separa a arma como objeto próprio (continua com o mesmo esqueleto)
bpy.context.view_layer.objects.active = o
for x in bpy.data.objects: x.select_set(x == o)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for i in sel: o.data.vertices[i].select = True
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
novo = [x for x in bpy.context.selected_objects if x != o][0]
novo.name = a.nome; novo.data.name = a.nome
# tira o Icosphere de ajuda que o importador às vezes cria
for x in list(bpy.data.objects):
    if x.type == "MESH" and x.parent is None and x.name.startswith("Icosphere"):
        bpy.data.objects.remove(x)
print("ACOES", [ac.name for ac in bpy.data.actions])
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_yup=True)
print("OK", a.dst)
