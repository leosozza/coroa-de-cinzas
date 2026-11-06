import bpy, sys, collections
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index("--")+1])
o=[x for x in bpy.data.objects if x.type=="MESH" and x.parent][0]; mw=o.matrix_world; nm={g.index:g.name for g in o.vertex_groups}
h=collections.Counter(); dom=collections.Counter()
for v in o.data.vertices:
    p=mw@v.co
    if p.z>0.3: h[round(p.x,2)//0.03*0.03]+=1
    if p.x < -0.08 and p.z > 0.3:
        d=max(v.groups,key=lambda g:g.weight,default=None)
        if d: dom[nm[d.group]]+=1
print("XHIST", sorted((round(k,2),c) for k,c in h.items()))
print("ATRAS", dom.most_common(8))
