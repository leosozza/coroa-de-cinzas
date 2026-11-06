import bpy, sys, collections
argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]
mw = o.matrix_world; names = {g.index: g.name for g in o.vertex_groups}
X0, Z0, Z1 = float(argv[1]), float(argv[2]), float(argv[3])
c = collections.Counter(); n = 0
for v in o.data.vertices:
    p = mw @ v.co
    if p.x > X0 and Z0 < p.z < Z1:
        n += 1
        g = max(v.groups, key=lambda g: g.weight, default=None)
        if g: c[names[g.group]] += 1
print("PESOS", n, "vértices na região; osso dominante:", c.most_common())
