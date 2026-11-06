import bpy, sys, bmesh
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]
bm = bmesh.new(); bm.from_mesh(o.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
bm.verts.ensure_lookup_table()
seen=set(); isl=[]
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
print("ILHAS", len(isl), "após juntar vértices:", len(bm.verts))
for c in isl[:8]:
    ps=[v.co for v in c]
    print("ILHA", len(c), "x", round(min(p.x for p in ps),2), round(max(p.x for p in ps),2), "y", round(min(p.y for p in ps),2), round(max(p.y for p in ps),2), "z", round(min(p.z for p in ps),2), round(max(p.z for p in ps),2))
# fatia por altura: pontos fora do corpo (|x|>0.2) entre z 0.1 e 0.9
import collections
h=collections.Counter()
for v in bm.verts:
    if abs(v.co.x)>0.18 and 0.05<v.co.z<0.9: h[(round(v.co.x,1), round(v.co.z,1))]+=1
print("FORA", sorted(h.items())[:60])
