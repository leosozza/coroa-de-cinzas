import bpy, sys
argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]
mw = o.matrix_world; names = {g.index: g.name for g in o.vertex_groups}
x0, x1, z0, z1, W, H = 0.10, 0.55, 0.0, 0.40, 45, 20
g = [[" "]*W for _ in range(H)]
cod = {"LeftUpLeg":"u", "LeftLeg":"l", "LeftHand":"H", "LeftForeArm":"f", "Hips":"p", "LeftFoot":"F", "LeftToeBase":"T", "Spine":"s", "Spine01":"s", "Spine02":"s"}
for v in o.data.vertices:
    p = mw @ v.co
    i = int((p.x-x0)/(x1-x0)*W); j = int((z1-p.z)/(z1-z0)*H)
    if 0<=i<W and 0<=j<H:
        d = max(v.groups, key=lambda q: q.weight, default=None)
        g[j][i] = cod.get(names[d.group], "?") if d else "."
for j,row in enumerate(g):
    print("M %4.2f |" % (z1-(j+0.5)*(z1-z0)/H) + "".join(row) + "|")
print("M x: 0.10 ... 0.46 (1 col = 1 cm)")
