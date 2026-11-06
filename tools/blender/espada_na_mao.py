"""Remove a lâmina grudada no corpo do peão do Meshy e põe uma espada limpa presa ao osso da mão.

Uso: Blender -b --factory-startup --python tools/blender/espada_na_mao.py -- entrada.glb saida.glb
A espada vira o nó "Espada", filho do osso LeftHand: segue a mão em todas as animações e o jogo pode soltá-la (arremesso).
Medidas e região da lâmina antiga medidas no peão de 06/11/2026 (pose A, 1,6 m de altura).
"""
import bpy, bmesh, sys
from mathutils import Vector, Matrix
src, dst = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
body = [x for x in bpy.data.objects if x.type == "MESH" and x.parent == arm][0]

# 1) apaga a lâmina antiga (linha fina que desce do quadril, por fora da saia)
mw = body.matrix_world
def na_lamina(p):
    if not (0.22 < p.z < 0.765): return False
    lx = 0.24 + (0.70 - p.z) * 0.28
    tol = 0.03 if p.z < 0.70 else 0.018
    return abs(p.x - lx) < tol and p.x > 0.215
bm = bmesh.new(); bm.from_mesh(body.data)
mata = [v for v in bm.verts if na_lamina(mw @ v.co)]
print("LAMINA_ANTIGA", len(mata), "vértices removidos")
bmesh.ops.delete(bm, geom=mata, context="VERTS"); bm.to_mesh(body.data); bm.free()

# 2) espada nova, construída ao longo de +Z local (cabo em z<0, lâmina em z>0)
def mat(nome, cor, metal, rug):
    m = bpy.data.materials.new(nome); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*cor, 1); b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rug
    return m
aco = mat("Espada_aco", (0.86, 0.88, 0.92), 0.45, 0.32)
ouro = mat("Espada_ouro", (0.90, 0.68, 0.24), 0.55, 0.35)
couro = mat("Espada_couro", (0.30, 0.18, 0.10), 0.0, 0.8)
me = bpy.data.meshes.new("Espada"); sw = bpy.data.objects.new("Espada", me); bpy.context.scene.collection.objects.link(sw)
for m in (aco, ouro, couro): me.materials.append(m)
bm = bmesh.new()
def caixa(cx, cy, cz, sx, sy, sz, mi):
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r["verts"]
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=vs); bmesh.ops.translate(bm, vec=(cx, cy, cz), verts=vs)
    for f in {f for v in vs for f in v.link_faces}: f.material_index = mi
    return vs
L, W, T = 0.62, 0.055, 0.012                     # lâmina
vs = caixa(0, 0, 0.05 + L/2, W, T, L, 0)
for v in vs:                                        # afina até a ponta
    if v.co.z > 0.05 + L - 0.001: v.co.x *= 0.05; v.co.z += 0.04
caixa(0, 0, 0.035, 0.17, 0.022, 0.024, 1)          # guarda
caixa(0, 0, -0.035, 0.028, 0.028, 0.11, 2)         # cabo
r = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.022)  # pomo
bmesh.ops.translate(bm, vec=(0, 0, -0.1), verts=r["verts"])
for f in {f for v in r["verts"] for f in v.link_faces}: f.material_index = 1
bm.to_mesh(me); bm.free()

# 3) posiciona na mão: cabo no centro da mão, lâmina para a frente do personagem
amw = arm.matrix_world
fa = amw @ arm.data.bones["LeftForeArm"].head_local
hd = amw @ arm.data.bones["LeftHand"].head_local
d = (hd - fa).normalized()                         # direção do braço
centro = hd + d * 0.055
frente = Vector((0, -1, 0))                         # glTF +Z (frente) = -Y no Blender
lam = (frente - frente.dot(d) * d).normalized()     # lâmina perpendicular ao braço, apontando para a frente
guarda = lam.cross(d).normalized(); y = lam.cross(guarda)
R = Matrix((guarda, y, lam)).transposed().to_4x4()
alvo = Matrix.Translation(centro) @ R
sw.parent = arm; sw.parent_type = "BONE"; sw.parent_bone = "LeftHand"
bpy.context.view_layer.update()
sw.matrix_world = alvo
print("ESPADA centro", [round(c, 3) for c in centro], "lâmina", [round(c, 3) for c in lam])
for x in list(bpy.data.objects):
    if x.type == "MESH" and x.parent is None and x.name.startswith("Icosphere"): bpy.data.objects.remove(x)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=True,
                          export_animation_mode="ACTIONS", export_image_format="JPEG", export_yup=True)
print("OK", dst)
