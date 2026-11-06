import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index("--")+1])
arm = [x for x in bpy.data.objects if x.type == "ARMATURE"][0]; mw = arm.matrix_world
for n in ("LeftForeArm", "LeftHand", "RightHand"):
    b = arm.data.bones[n]
    print("B", n, "head", [round(c,3) for c in mw @ b.head_local], "tail", [round(c,3) for c in mw @ b.tail_local],
          "x", [round(c,3) for c in (mw.to_3x3() @ b.matrix_local.to_3x3().col[0]).normalized()],
          "z", [round(c,3) for c in (mw.to_3x3() @ b.matrix_local.to_3x3().col[2]).normalized()])
print("B kids LeftHand:", [c.name for c in arm.data.bones["LeftHand"].children])
