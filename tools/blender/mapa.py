import bpy, sys
argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]
mw = o.matrix_world
pts = [mw @ v.co for v in o.data.vertices]
W, H = 60, 50
x0, x1, z0, z1 = -0.5, 0.5, 0.0, 1.65
g = [[0]*W for _ in range(H)]
for p in pts:
    i = int((p.x-x0)/(x1-x0)*W); j = int((z1-p.z)/(z1-z0)*H)
    if 0<=i<W and 0<=j<H: g[j][i]+=1
for j,row in enumerate(g):
    print("MAP %4.2f " % (z1-(j+0.5)*(z1-z0)/H) + "".join(" " if c==0 else ("." if c<3 else ("o" if c<10 else "#")) for c in row))
print("MAP x de", x0, "a", x1)
