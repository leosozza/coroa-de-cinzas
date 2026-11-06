import bpy, sys, bmesh
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index("--")+1])
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]; mw = o.matrix_world
bm = bmesh.new(); bm.from_mesh(o.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
bm.verts.ensure_lookup_table(); seen=set(); isl=[]
for v in bm.verts:
    if v.index in seen: continue
    st=[v]; cur=[]; seen.add(v.index)
    while st:
        x=st.pop(); cur.append(x)
        for e in x.link_edges:
            y=e.other_vert(x)
            if y.index not in seen: seen.add(y.index); st.append(y)
    isl.append(cur)
isl.sort(key=len, reverse=True)
print("I total", len(isl))
for c in isl[:6]:
    ps=[mw @ v.co for v in c]
    print("I", len(c), "x %.2f..%.2f y %.2f..%.2f z %.2f..%.2f" % (min(p.x for p in ps), max(p.x for p in ps), min(p.y for p in ps), max(p.y for p in ps), min(p.z for p in ps), max(p.z for p in ps)))
