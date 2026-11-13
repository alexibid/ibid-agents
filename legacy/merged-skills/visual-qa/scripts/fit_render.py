import json
import math
import os
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Vector

RESULT_MARKER = "VISUALQA_RESULT "
SEARCH_SIZE = 256
COMPARE_SIZE = 128
WELD_DISTANCE = 1e-5
AZIMUTHS = range(0, 360, 10)
ELEVATIONS = (5, 15, 25, 35, 45, 55)
SIDE_VIEWS = {"right": 90, "back": 180, "left": 270}
SIDE_ELEVATION = 20


def read_settings() -> dict:
    return json.loads(sys.argv[sys.argv.index("--") + 1])


def import_model(path: str):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [item for item in bpy.context.scene.objects if item.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for item in meshes:
        item.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    if len(meshes) > 1:
        bpy.ops.object.join()
    item = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    corners = [item.matrix_world @ Vector(c) for c in item.bound_box]
    low = Vector((min(c[i] for c in corners) for i in range(3)))
    high = Vector((max(c[i] for c in corners) for i in range(3)))
    return item, (low + high) / 2, (high - low).length


def count_islands(item) -> int:
    surface = bmesh.new()
    surface.from_mesh(item.data)
    bmesh.ops.remove_doubles(surface, verts=surface.verts, dist=WELD_DISTANCE)
    surface.faces.ensure_lookup_table()
    seen, islands = set(), 0
    for start in surface.faces:
        if start.index in seen:
            continue
        islands += 1
        stack = [start]
        seen.add(start.index)
        while stack:
            face = stack.pop()
            for edge in face.edges:
                for neighbour in edge.link_faces:
                    if neighbour.index not in seen:
                        seen.add(neighbour.index)
                        stack.append(neighbour)
    surface.free()
    return islands


def configure_scene(size: int):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.show_cavity = False
    scene.view_settings.view_transform = "Standard"
    camera = bpy.data.objects.new("QACamera", bpy.data.cameras.new("QACamera"))
    camera.data.type = "ORTHO"
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def aim_camera(camera, centre, extent, azimuth, elevation):
    a, e = math.radians(azimuth), math.radians(elevation)
    direction = Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e)))
    camera.location = centre + direction * extent * 2
    camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = extent * 1.05
    camera.data.clip_start, camera.data.clip_end = extent * 0.001, extent * 20


def render_rgba(scene, size: int) -> np.ndarray:
    scene.render.resolution_x = scene.render.resolution_y = size
    path = os.path.join(tempfile.mkdtemp(), "render.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(path)
    pixels = np.empty(size * size * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return np.flipud(pixels.reshape(size, size, 4))


def normalised_mask(mask: np.ndarray) -> np.ndarray:
    rows, cols = np.nonzero(mask)
    if len(rows) == 0:
        return np.zeros((COMPARE_SIZE, COMPARE_SIZE), dtype=bool)
    crop = mask[rows.min():rows.max() + 1, cols.min():cols.max() + 1]
    side = max(crop.shape)
    square = np.zeros((side, side), dtype=np.uint8)
    square[:crop.shape[0], :crop.shape[1]] = crop
    index = (np.arange(COMPARE_SIZE) * side / COMPARE_SIZE).astype(int)
    return square[np.ix_(index, index)] > 0


def overlap(first: np.ndarray, second: np.ndarray) -> float:
    union = np.logical_or(first, second).sum()
    return float(np.logical_and(first, second).sum() / union) if union else 0.0


def read_art_mask(path: str) -> np.ndarray:
    image = bpy.data.images.load(path)
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return np.flipud(pixels.reshape(height, width, 4))[:, :, 3] > 0.5


def search_best_view(scene, camera, centre, extent, art_mask):
    best = {"iou": -1.0, "azimuth": 0, "elevation": 0}
    for elevation in ELEVATIONS:
        for azimuth in AZIMUTHS:
            aim_camera(camera, centre, extent, azimuth, elevation)
            score = overlap(normalised_mask(render_rgba(scene, SEARCH_SIZE)[:, :, 3] > 0.5), art_mask)
            if score > best["iou"]:
                best = {"iou": score, "azimuth": azimuth, "elevation": elevation}
    return best


def save_views(scene, camera, centre, extent, best, settings):
    size = int(settings["size"])
    views = {"fit": (best["azimuth"], best["elevation"])}
    views.update({name: (best["azimuth"] + offset, SIDE_ELEVATION) for name, offset in SIDE_VIEWS.items()})
    for name, (azimuth, elevation) in views.items():
        aim_camera(camera, centre, extent, azimuth, elevation)
        scene.render.resolution_x = scene.render.resolution_y = size
        scene.render.filepath = os.path.join(settings["output_dir"], f"{settings['label']}-{name}.png")
        bpy.ops.render.render(write_still=True)


def main():
    settings = read_settings()
    os.makedirs(settings["output_dir"], exist_ok=True)
    item, centre, extent = import_model(settings["glb"])
    scene, camera = configure_scene(SEARCH_SIZE)
    fixed = settings.get("camera")
    art_mask = normalised_mask(read_art_mask(settings["art"]))
    if fixed:
        aim_camera(camera, centre, extent, fixed[0], fixed[1])
        best = {"iou": overlap(normalised_mask(render_rgba(scene, SEARCH_SIZE)[:, :, 3] > 0.5), art_mask), "azimuth": fixed[0], "elevation": fixed[1]}
    else:
        best = search_best_view(scene, camera, centre, extent, art_mask)
    save_views(scene, camera, centre, extent, best, settings)
    report = {**best, "faces": len(item.data.polygons), "islands": count_islands(item)}
    print(RESULT_MARKER + json.dumps(report))


main()
