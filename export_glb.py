import bpy
import os

print("=== Starting GLB Export ===")

# Deselect all
for obj in bpy.data.objects:
    obj.select_set(False)

root = bpy.data.objects.get("ACE_Turbine_Root")
if not root:
    print("ERROR: ACE_Turbine_Root not found!")
    exit(1)

def select_hierarchy(obj):
    obj.select_set(True)
    for child in obj.children:
        select_hierarchy(child)

select_hierarchy(root)
bpy.context.view_layer.objects.active = root

out_path = os.path.abspath(os.path.join("public", "models", "ace_turbine.glb"))
os.makedirs(os.path.dirname(out_path), exist_ok=True)

print(f"Exporting selected hierarchy to {out_path}...")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_yup=True,
)

if os.path.exists(out_path):
    print(f"=== GLB Export Completed Successfully: {os.path.getsize(out_path)} bytes ===")
else:
    print("ERROR: GLB file was not created!")
