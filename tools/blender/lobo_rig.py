"""Rig geométrico para um quadrúpede estático da Meshy (o lobo gigante): armature com raiz, pélvis, peito, pescoço, cabeça,
cauda (3) e as quatro patas (coxa e canela), posicionados pela caixa da malha, e pesos por região com transição suave
(no máximo 2 ossos por vértice). O jogo anima os ossos por código. Não há animações no arquivo.

Uso: Blender -b --factory-startup --python tools/blender/lobo_rig.py -- entrada.glb saida.glb [--joelho -0.3] [--barriga -0.22]
Coordenadas nos comentários e nos argumentos: as do glTF (y para cima, frente +z); o Blender importa como (x, -z, y).
Supõe o modelo de frente para +z (cabeça = z máximo acima do meio; cauda = z mínimo).
"""
import argparse, bpy, sys
from mathutils import Vector

ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--joelho", type=float, default=None, help="altura (fração 0-1 da altura) do joelho; padrão 0.15")
ap.add_argument("--barriga", type=float, default=None, help="altura (fração) onde a pata vira corpo; padrão 0.30")
ap.add_argument("--cauda", type=float, default=None, help="z (fração 0-1 do comprimento) onde começa a cauda; padrão automático")
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
o = [x for x in bpy.data.objects if x.type == "MESH"][0]
mw = o.matrix_world
gl = lambda p: Vector((p.x, p.z, -p.y))          # Blender -> glTF
bl = lambda v: Vector((v[0], -v[2], v[1]))       # glTF -> Blender
P = [gl(mw @ v.co) for v in o.data.vertices]
mn = Vector([min(p[i] for p in P) for i in range(3)]); mx = Vector([max(p[i] for p in P) for i in range(3)])
H = mx.y - mn.y; LEN = mx.z - mn.z
fy = lambda f: mn.y + H * f
fz = lambda f: mn.z + LEN * f
print("CAIXA min", [round(c, 3) for c in mn], "max", [round(c, 3) for c in mx], "altura", round(H, 3), "comprimento", round(LEN, 3))

def sm(v, a0, a1):
    """smoothstep: 0 em a0, 1 em a1 (a0 pode ser maior que a1)"""
    t = (v - a0) / (a1 - a0); t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return t * t * (3 - 2 * t)
def cen(S):
    return sum(S, Vector()) / len(S) if S else None

# ---- regiões pela geometria ----
Y_KNEE = fy(a.joelho if a.joelho is not None else 0.15)
Y_BELLY = fy(a.barriga if a.barriga is not None else 0.30)      # acima disto é corpo; abaixo, pata
low = [p for p in P if p.y < fy(0.25)]
# cauda: fatias de z, a partir de trás, enquanto não houver vértice no chão (pata) e a fatia for estreita
if a.cauda is not None: Z_TAIL = fz(a.cauda)
else:
    Z_TAIL = mn.z + LEN * 0.12
    for k in range(40):
        z0 = mn.z + LEN * k / 40; S = [p for p in P if z0 <= p.z < z0 + LEN / 40]
        if S and min(p.y for p in S) < fy(0.06): Z_TAIL = z0 - LEN * 0.03; break
tail_pts = [p for p in P if p.z < Z_TAIL]
# patas: vértices baixos, sem a cauda, em quatro quadrantes (frente/trás pela mediana de z, esq/dir pelo sinal de x)
legs_pts = [p for p in low if p.z >= Z_TAIL]
zmid = sorted(p.z for p in legs_pts)[len(legs_pts) // 2]
Q = {}
for nm, fz_ok, fx_ok in (("FR", lambda z: z >= zmid, lambda x: x > 0), ("FL", lambda z: z >= zmid, lambda x: x < 0),
                         ("BR", lambda z: z < zmid, lambda x: x > 0), ("BL", lambda z: z < zmid, lambda x: x < 0)):
    S = [p for p in legs_pts if fz_ok(p.z) and fx_ok(p.x) and abs(p.x) > (mx.x - mn.x) * 0.08]
    c = cen(S) or Vector((0.15 * (1 if "R" in nm else -1), mn.y, zmid + (0.3 if "F" in nm else -0.3)))
    Q[nm] = Vector((c.x, mn.y, c.z))
    print("PATA", nm, len(S), "x", round(c.x, 3), "z", round(c.z, 3))
ZF = (Q["FR"].z + Q["FL"].z) / 2; ZH = (Q["BR"].z + Q["BL"].z) / 2
Y_HIP = fy(0.46)
# cabeça/pescoço: z a partir de onde não há mais vértice baixo (a frente das patas dianteiras)
Z_NECK = ZF + LEN * 0.06; Z_HEAD = Z_NECK + LEN * 0.09
head_pts = [p for p in P if p.z > Z_HEAD]
hc = cen(head_pts) or Vector((0, fy(0.75), mx.z - LEN * 0.1))
print("CAUDA z <", round(Z_TAIL, 3), len(tail_pts), "vértices; PESCOÇO z >", round(Z_NECK, 3), "CABEÇA z >", round(Z_HEAD, 3), len(head_pts), "centro", [round(c, 3) for c in hc])

# ---- ossos (glTF) ----
tail_c = []
for k in range(4):
    z0 = mn.z + (Z_TAIL - mn.z) * (3 - k) / 4; z1 = z0 + (Z_TAIL - mn.z) / 4
    S = [p for p in tail_pts if z0 <= p.z < z1]; tail_c.append(cen(S) or Vector((0, fy(0.3), (z0 + z1) / 2)))
tail_base = Vector((tail_c[0].x * 0.5, max(tail_c[0].y, fy(0.4)), Z_TAIL))
tail_tip = Vector((tail_c[3].x, tail_c[3].y, mn.z))
bones = {}
def B(name, head, tail, parent=None):
    bones[name] = (Vector(head), Vector(tail), parent)
hip = Vector((0, Y_HIP, ZH)); mid = Vector((0, fy(0.55), (ZH + ZF) / 2)); sho = Vector((0, fy(0.55), ZF))
neck0 = Vector((0, fy(0.62), Z_NECK)); head0 = Vector((0, min(hc.y + H * 0.05, fy(0.8)), Z_HEAD)); head1 = Vector((0, hc.y, mx.z))
B("root", (0, mn.y, (ZH + ZF) / 2), (0, mn.y, (ZH + ZF) / 2 + LEN * 0.1))
B("pelvis", hip, mid, "root")
B("chest", mid, sho, "pelvis")
B("neck", neck0, head0, "chest")
B("head", head0, head1, "neck")
B("tail1", tail_base, tail_c[1], "pelvis")
B("tail2", tail_c[1], tail_c[2], "tail1")
B("tail3", tail_c[2], tail_tip, "tail2")
for nm, par in (("FR", "chest"), ("FL", "chest"), ("BR", "pelvis"), ("BL", "pelvis")):
    c = Q[nm]
    top = Vector((c.x * 0.9, Y_HIP, c.z)); knee = Vector((c.x, Y_KNEE, c.z + (LEN * 0.02 if nm[0] == "F" else -LEN * 0.02))); foot = Vector((c.x, mn.y, c.z))
    B("thigh_" + nm, top, knee, par); B("shin_" + nm, knee, foot, "thigh_" + nm)
for n, (h, t, p) in bones.items(): print("OSSO", n, [round(c, 3) for c in h], "->", [round(c, 3) for c in t], "pai", p)

# ---- pesos por região ----
def seg_t(p, a0, a1):
    d = a1 - a0; L2 = d.length_squared
    return 0.0 if L2 < 1e-9 else max(0.0, min(1.0, (p - a0).dot(d) / L2))
W = [dict() for _ in P]
for i, p in enumerate(P):
    w = {}
    rem = 1.0
    # cauda
    wt = sm(p.z, Z_TAIL + LEN * 0.05, Z_TAIL - LEN * 0.03) * sm(p.y, fy(0.72), fy(0.6))
    if wt > 0:
        t = sm(p.z, tail_base.z, tail_tip.z)
        s2 = sm(t, 0.22, 0.45); s3 = sm(t, 0.58, 0.8)
        w["tail1"] = wt * (1 - s2); w["tail2"] = wt * s2 * (1 - s3); w["tail3"] = wt * s3
        rem -= wt
    # cabeça e pescoço (só acima da linha das patas dianteiras)
    if rem > 0:
        wh = sm(p.z, Z_HEAD - LEN * 0.04, Z_HEAD + LEN * 0.05) * sm(p.y, fy(0.38), fy(0.5))
        wn = sm(p.z, Z_NECK - LEN * 0.06, Z_NECK + LEN * 0.03) * sm(p.y, fy(0.56), fy(0.68)) * (1 - wh)
        if wh > 0: w["head"] = rem * wh
        if wn > 0: w["neck"] = rem * wn
        rem *= (1 - wh - wn)
    # patas: fator de altura × zona em z (frente/trás) × lado
    if rem > 0:
        legk = sm(p.y, Y_BELLY + H * 0.1, Y_BELLY - H * 0.06)
        if legk > 0:
            zf = sm(abs(p.z - ZF), LEN * 0.2, LEN * 0.1); zh = sm(abs(p.z - ZH), LEN * 0.2, LEN * 0.1)
            if zf + zh > 1: zf, zh = zf / (zf + zh), zh / (zf + zh)
            side_r = sm(p.x, -(mx.x - mn.x) * 0.06, (mx.x - mn.x) * 0.06)
            shin = sm(p.y, Y_KNEE + H * 0.06, Y_KNEE - H * 0.06)
            tot = 0.0
            for zone, nmF in ((zf, "F"), (zh, "B")):
                if zone <= 0: continue
                for sk, nmS in ((side_r, "R"), (1 - side_r, "L")):
                    k = legk * zone * sk
                    if k <= 1e-4: continue
                    nm = nmF + nmS
                    w["thigh_" + nm] = w.get("thigh_" + nm, 0) + rem * k * (1 - shin)
                    w["shin_" + nm] = w.get("shin_" + nm, 0) + rem * k * shin
                    tot += k
            rem *= (1 - min(1.0, tot))
    # o resto é corpo: peito à frente, pélvis atrás
    if rem > 1e-4:
        ch = sm(p.z, mid.z - LEN * 0.12, mid.z + LEN * 0.12)
        w["chest"] = w.get("chest", 0) + rem * ch; w["pelvis"] = w.get("pelvis", 0) + rem * (1 - ch)
    # no máximo 2 ossos por vértice
    top = sorted(w.items(), key=lambda kv: -kv[1])[:2]
    s = sum(v for _, v in top) or 1.0
    W[i] = {k: v / s for k, v in top if v > 0}

# ---- armature + grupos ----
arm_data = bpy.data.armatures.new("Armature"); arm = bpy.data.objects.new("Armature", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
eb = {}
for n, (h, t, p) in bones.items():
    e = arm_data.edit_bones.new(n); e.head = bl(h); e.tail = bl(t); eb[n] = e
for n, (h, t, p) in bones.items():
    if p: eb[n].parent = eb[p]
bpy.ops.object.mode_set(mode="OBJECT")
for n in bones: o.vertex_groups.new(name=n)
vg = {g.name: g for g in o.vertex_groups}
for i, w in enumerate(W):
    for n, v in w.items(): vg[n].add([i], v, "REPLACE")
mod = o.modifiers.new("Armature", "ARMATURE"); mod.object = arm
o.parent = arm
# conferência: osso dominante por vértice e a caixa de cada grupo
import collections
dom = collections.Counter(); box = {}
for i, w in enumerate(W):
    if not w: dom["(nenhum)"] += 1; continue
    n = max(w, key=w.get); dom[n] += 1
    b = box.setdefault(n, [Vector(P[i]), Vector(P[i])])
    for k in range(3): b[0][k] = min(b[0][k], P[i][k]); b[1][k] = max(b[1][k], P[i][k])
for n, c in dom.most_common():
    b = box.get(n); print("PESO", n, c, "caixa", [round(v, 2) for v in b[0]], [round(v, 2) for v in b[1]] if b else "")
bpy.ops.export_scene.gltf(filepath=a.dst, export_format="GLB", export_animations=False, export_yup=True, export_skins=True, export_image_format="AUTO")
print("OK", a.dst)
