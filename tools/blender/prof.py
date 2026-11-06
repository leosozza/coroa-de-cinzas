import bpy, sys, collections
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index("--")+1])
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]; mw = o.matrix_world
c = collections.Counter()
for v in o.data.vertices:
    p = mw @ v.co
    if p.x > 0.30 and 0.45 < p.z < 0.95: c[round(p.y, 2)] += 1
print("Y", sorted(c.items()))
