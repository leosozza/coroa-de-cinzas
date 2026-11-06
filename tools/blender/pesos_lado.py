import bpy, sys, collections
a = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]
mw = o.matrix_world; names = {g.index: g.name for g in o.vertex_groups}
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]
for n in ("RightHand", "LeftHand"):
    print("OSSO", n, [round(c,3) for c in arm.matrix_world @ arm.data.bones[n].head_local])
for lado, cond in (("direita(x<-0.22)", lambda p: p.x < -0.22), ("esquerda(x>0.22)", lambda p: p.x > 0.22)):
    for z0, z1 in ((0.0, 0.5), (0.5, 0.8), (0.8, 1.1)):
        c = collections.Counter()
        for v in o.data.vertices:
            p = mw @ v.co
            if cond(p) and z0 < p.z < z1:
                d = max(v.groups, key=lambda g: g.weight, default=None)
                if d: c[names[d.group]] += 1
        print("PESO", lado, z0, z1, c.most_common(4))
