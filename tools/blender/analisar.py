import bpy, sys, bmesh
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
for o in bpy.data.objects:
    print("OBJ", o.type, o.name, [round(v,3) for v in o.dimensions], o.parent.name if o.parent else None)
    if o.type == "MESH":
        me = o.data; bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
        seen = set(); islands = []
        for v in bm.verts:
            if v.index in seen: continue
            stack = [v]; isl = []; seen.add(v.index)
            while stack:
                x = stack.pop(); isl.append(x)
                for e in x.link_edges:
                    y = e.other_vert(x)
                    if y.index not in seen: seen.add(y.index); stack.append(y)
            islands.append(isl)
        islands.sort(key=len, reverse=True)
        print("  vertices", len(bm.verts), "ilhas", len(islands))
        mw = o.matrix_world
        for isl in islands[:12]:
            ps = [mw @ v.co for v in isl]
            mn = Vector((min(p.x for p in ps), min(p.y for p in ps), min(p.z for p in ps)))
            mx = Vector((max(p.x for p in ps), max(p.y for p in ps), max(p.z for p in ps)))
            print("  ilha", len(isl), "min", [round(c,2) for c in mn], "max", [round(c,2) for c in mx])
        vg = {g.index: g.name for g in o.vertex_groups}
        print("  grupos", len(vg))
    if o.type == "ARMATURE":
        for b in o.data.bones:
            if "Hand" in b.name or b.name in ("Hips",):
                print("  osso", b.name, [round(c,3) for c in (o.matrix_world @ b.head_local)])
