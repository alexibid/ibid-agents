import argparse
import math
import os
import subprocess
import sys
import tempfile
from PIL import Image

BLENDER_BIN = "/Applications/Blender.app/Contents/MacOS/Blender" if os.path.exists("/Applications/Blender.app/Contents/MacOS/Blender") else "blender"

BLENDER_RENDER_CODE = """
import bpy
import math
import sys
from mathutils import Matrix, Vector

def render_model():
    args = sys.argv[sys.argv.index("--") + 1:]
    glb_path = args[0]
    out_path = args[1]
    azimuth = float(args[2])
    elevation = float(args[3])
    focus = args[4]
    zoom = float(args[5])
    resolution = int(args[6])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"

    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.898, 0.898, 0.898, 1.0)
        bg.inputs["Strength"].default_value = 1.0

    bpy.ops.import_scene.gltf(filepath=glb_path)
    meshes = [o for o in scene.objects if o.type == 'MESH']
    if not meshes:
        raise ValueError(f"No mesh objects found in {glb_path}")

    for mat in bpy.data.materials:
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == "BSDF_PRINCIPLED":
                    node.inputs["Roughness"].default_value = 1.0
                    node.inputs["Metallic"].default_value = 0.0

    verts = [m.matrix_world @ v.co for m in meshes for v in m.data.vertices]
    z_min = min(v.z for v in verts)
    z_max = max(v.z for v in verts)
    total_height = z_max - z_min

    if focus in ("head", "eyes", "snout", "ears"):
        sub_verts = [v for v in verts if v.z > z_min + 0.65 * total_height]
        if not sub_verts:
            sub_verts = verts
        target_center = sum(sub_verts, Vector((0, 0, 0))) / len(sub_verts)
        if focus == "eyes":
            target_center += Vector((0, -0.015 * total_height, -0.01 * total_height))
            radius = max((v - target_center).length for v in sub_verts) * 0.7
        elif focus == "snout":
            target_center += Vector((0, -0.025 * total_height, -0.02 * total_height))
            radius = max((v - target_center).length for v in sub_verts) * 0.6
        elif focus == "ears":
            target_center += Vector((0, 0.0, 0.03 * total_height))
            radius = max((v - target_center).length for v in sub_verts) * 0.8
        else:
            radius = max((v - target_center).length for v in sub_verts)
    elif focus == "chest":
        sub_verts = [v for v in verts if (z_min + 0.35 * total_height <= v.z <= z_min + 0.70 * total_height)]
        if not sub_verts:
            sub_verts = verts
        target_center = sum(sub_verts, Vector((0, 0, 0))) / len(sub_verts) + Vector((0, -0.02, 0))
        radius = max((v - target_center).length for v in sub_verts)
    elif focus in ("paws", "paws_front", "paws_back"):
        sub_verts = [v for v in verts if v.z < z_min + 0.30 * total_height]
        if not sub_verts:
            sub_verts = verts
        target_center = sum(sub_verts, Vector((0, 0, 0))) / len(sub_verts)
        radius = max((v - target_center).length for v in sub_verts)
    elif focus == "tail":
        sub_verts = [v for v in verts if v.y > 0.02]
        if not sub_verts:
            sub_verts = verts
        target_center = sum(sub_verts, Vector((0, 0, 0))) / len(sub_verts)
        radius = max((v - target_center).length for v in sub_verts)
    else:
        target_center = sum(verts, Vector((0, 0, 0))) / len(verts)
        radius = max((v - target_center).length for v in verts)

    cam_data = bpy.data.cameras.new("InspectorCam")
    cam_data.lens = 65.0
    cam_data.clip_start = max(radius * 0.001, 1e-5)
    cam_data.clip_end = radius * 200.0
    cam_obj = bpy.data.objects.new("InspectorCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    rad_az = math.radians(azimuth)
    rad_el = math.radians(elevation)
    cam_dir = Vector((math.sin(rad_az), -math.cos(rad_az), math.sin(rad_el))).normalized()
    cam_pos = target_center + cam_dir * (radius * zoom)

    look_dir = (target_center - cam_pos).normalized()
    up = Vector((0, 0, 1))
    right = look_dir.cross(up).normalized()
    cam_up = right.cross(look_dir).normalized()
    mat = Matrix((right, cam_up, -look_dir)).transposed().to_4x4()
    mat.translation = cam_pos
    cam_obj.matrix_world = mat

    light_data = bpy.data.lights.new("Sun", type="SUN")
    light_data.energy = 1.6
    light_obj = bpy.data.objects.new("Sun", light_data)
    scene.collection.objects.link(light_obj)
    light_obj.matrix_world = mat

    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)

if __name__ == "__main__":
    render_model()
"""

PRESETS = {
    "front": {"azimuth": 0.0, "elevation": 0.0, "focus": "full", "zoom": 2.4},
    "back": {"azimuth": 180.0, "elevation": 0.0, "focus": "full", "zoom": 2.4},
    "left": {"azimuth": -90.0, "elevation": 0.0, "focus": "full", "zoom": 2.4},
    "right": {"azimuth": 90.0, "elevation": 0.0, "focus": "full", "zoom": 2.4},
    "iso": {"azimuth": 22.0, "elevation": 7.0, "focus": "full", "zoom": 2.35},
    "head": {"azimuth": 22.0, "elevation": 7.0, "focus": "head", "zoom": 2.35},
    "eyes": {"azimuth": 12.0, "elevation": 4.0, "focus": "eyes", "zoom": 1.6},
    "snout": {"azimuth": 8.0, "elevation": -2.0, "focus": "snout", "zoom": 1.5},
    "ears": {"azimuth": 18.0, "elevation": 14.0, "focus": "ears", "zoom": 1.8},
    "chest": {"azimuth": 10.0, "elevation": 2.0, "focus": "chest", "zoom": 1.8},
    "paws": {"azimuth": 15.0, "elevation": -5.0, "focus": "paws", "zoom": 2.0},
    "tail": {"azimuth": 160.0, "elevation": 10.0, "focus": "tail", "zoom": 2.0},
}

def capture_view(glb_path: str, out_png: str, azimuth: float, elevation: float, focus: str, zoom: float, resolution: int = 512):
    handle, tmp_script = tempfile.mkstemp(suffix="_bpy_inspector_worker.py")
    with os.fdopen(handle, "w") as f:
        f.write(BLENDER_RENDER_CODE)

    cmd = [
        BLENDER_BIN,
        "--background",
        "--python", tmp_script,
        "--",
        os.path.abspath(glb_path),
        os.path.abspath(out_png),
        str(azimuth),
        str(elevation),
        focus,
        str(zoom),
        str(resolution)
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL)
    if os.path.exists(tmp_script):
        os.remove(tmp_script)

def create_comparison(render_path: str, ref_path: str, out_path: str, crop_box=None):
    render_img = Image.open(render_path).convert("RGB")
    ref_img = Image.open(ref_path).convert("RGB")

    if crop_box:
        ref_crop = ref_img.crop(crop_box)
    else:
        ref_crop = ref_img

    target_h = 512
    ref_w = int(ref_crop.width * (target_h / ref_crop.height))
    ref_scaled = ref_crop.resize((ref_w, target_h), Image.Resampling.LANCZOS)
    render_scaled = render_img.resize((target_h, target_h), Image.Resampling.LANCZOS)

    canvas_w = ref_scaled.width + render_scaled.width + 16
    composite = Image.new("RGB", (canvas_w, target_h), (229, 229, 229))
    composite.paste(ref_scaled, (0, 0))
    composite.paste(render_scaled, (ref_scaled.width + 16, 0))

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    composite.save(out_path)
    return out_path

def generate_multi_angle_audit(glb_path: str, out_dir: str, ref_path: str = None, resolution: int = 512):
    os.makedirs(out_dir, exist_ok=True)
    audit_presets = ["front", "iso", "left", "right", "back", "eyes", "snout", "paws"]
    rendered_files = []

    for name in audit_presets:
        cfg = PRESETS[name]
        out_file = os.path.join(out_dir, f"{name}.png")
        capture_view(glb_path, out_file, cfg["azimuth"], cfg["elevation"], cfg["focus"], cfg["zoom"], resolution)
        rendered_files.append((name, out_file))

    # Generate full 4x2 contact sheet for instant visual audit
    cell_w, cell_h = 360, 360
    sheet = Image.new("RGB", (cell_w * 4, cell_h * 2), (229, 229, 229))
    for idx, (name, fpath) in enumerate(rendered_files):
        row = idx // 4
        col = idx % 4
        img = Image.open(fpath).convert("RGB").resize((cell_w, cell_h), Image.Resampling.LANCZOS)
        sheet.paste(img, (col * cell_w, row * cell_h))

    grid_path = os.path.join(out_dir, "audit_sheet_360.png")
    sheet.save(grid_path)
    print(f"Generated complete 360° audit contact sheet: {grid_path}")
    return grid_path

def main():
    parser = argparse.ArgumentParser(description="3D GLB Camera Inspector and Multi-Angle Visual Audit Utility")
    parser.add_argument("--glb", required=True, help="Path to input .glb file")
    parser.add_argument("--out", default=None, help="Path to output render image (.png) or output directory with --audit-all")
    parser.add_argument("--preset", choices=list(PRESETS.keys()), default=None, help="Preset camera angle / focus")
    parser.add_argument("--azimuth", type=float, default=None, help="Azimuth angle in degrees")
    parser.add_argument("--elevation", type=float, default=None, help="Elevation angle in degrees")
    parser.add_argument("--focus", choices=["full", "head", "eyes", "snout", "ears", "chest", "paws", "tail"], default=None, help="Anatomical focus center")
    parser.add_argument("--zoom", type=float, default=None, help="Zoom multiplier relative to target radius")
    parser.add_argument("--ref", default=None, help="Optional 2D reference image path for side-by-side comparison")
    parser.add_argument("--crop", nargs=4, type=int, default=None, metavar=("X", "Y", "W", "H"), help="Optional crop box on reference image")
    parser.add_argument("--resolution", type=int, default=512, help="Output render resolution")
    parser.add_argument("--audit-all", action="store_true", help="Generate complete multi-angle audit sheet covering all key details")

    args = parser.parse_args()

    if args.audit_all:
        target_dir = args.out if args.out else os.path.join(tempfile.gettempdir(), "audit_views")
        generate_multi_angle_audit(args.glb, target_dir, ref_path=args.ref, resolution=args.resolution)
        return

    if not args.out:
        print("Error: --out is required when not using --audit-all", file=sys.stderr)
        sys.exit(1)

    az = 22.0
    el = 7.0
    focus = "full"
    zoom = 2.35

    if args.preset:
        p = PRESETS[args.preset]
        az = p["azimuth"]
        el = p["elevation"]
        focus = p["focus"]
        zoom = p["zoom"]

    if args.azimuth is not None:
        az = args.azimuth
    if args.elevation is not None:
        el = args.elevation
    if args.focus is not None:
        focus = args.focus
    if args.zoom is not None:
        zoom = args.zoom

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)

    if args.ref:
        tmp_single = os.path.join(tempfile.gettempdir(), f"render_inspect_{os.path.basename(args.glb)}.png")
        capture_view(args.glb, tmp_single, az, el, focus, zoom, args.resolution)
        crop_box = (args.crop[0], args.crop[1], args.crop[0] + args.crop[2], args.crop[1] + args.crop[3]) if args.crop else None
        create_comparison(tmp_single, args.ref, args.out, crop_box=crop_box)
        print(f"Comparison rendered successfully: {args.out}")
    else:
        capture_view(args.glb, args.out, az, el, focus, zoom, args.resolution)
        print(f"Rendered view successfully: {args.out}")

if __name__ == "__main__":
    main()
