import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index("--")+1])
arm=[x for x in bpy.data.objects if x.type=="ARMATURE"][0]; mw=arm.matrix_world
for b in arm.data.bones:
    if any(k in b.name for k in ("Spine","Hand","Forearm","Clavicle","Neck","Head")): print("OSSO", b.name, [round(c,3) for c in mw @ b.head_local])
