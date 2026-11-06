import bpy, sys
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index("--")+1])
o = [x for x in bpy.data.objects if x.type == "MESH" and x.parent][0]; mw = o.matrix_world
pts = sorted([(round(p.z,3), round(p.x,3), round(p.y,3)) for p in (mw @ v.co for v in o.data.vertices) if p.x > 0.2 and 0.2 < p.z < 0.8], reverse=True)
for t in pts: print("P z=%.3f x=%.3f y=%.3f" % t)
