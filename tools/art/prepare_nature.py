"""Normalize and optimize the eight Quaternius downloads in ASSET_MANIFEST.md.

Run blender --background --python tools/art/prepare_nature.py -- <download-dir>
with the source files named as specified in the manifest.
"""

from pathlib import Path
from hashlib import sha256
import sys

import bpy
from mathutils import Matrix, Vector


SOURCE_MODELS = {
    "PalmTree": (5.8, 1950, None),
    "FanPalm": (5.3, 1900, None),
    "CanopyTree": (6.3, 3300, None),
    "FlowerBush": (0.80, 960, None),
    "MossRock": (0.52, 100, None),
    "MeadowGrass": (0.46, 300, None),
    "Fern": (0.70, 250, None),
    "FieldFlowers": (0.49, 180, "Flower_5_Clump"),
}
OUTPUT = Path(__file__).resolve().parents[2] / "public" / "models" / "festival" / "nature.glb"
DISTANT_BUDGETS = {"CanopyTree": 760, "PalmTree": 530, "FanPalm": 480, "FlowerBush": 290}


def isolate_mesh(source, root_name):
    objects_before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = set(bpy.data.objects) - objects_before
    bpy.context.view_layer.update()
    meshes = [obj for obj in imported if obj.type == "MESH"
              and (root_name is None or root_name in obj.name or root_name in obj.data.name)]
    if not meshes:
        raise ValueError(f"No matching meshes in {source}")
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
    for obj in imported - set(meshes):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def set_ground_pivot(obj, height):
    positions = [vertex.co for vertex in obj.data.vertices]
    low = Vector(tuple(min(p[axis] for p in positions) for axis in range(3)))
    high = Vector(tuple(max(p[axis] for p in positions) for axis in range(3)))
    pivot = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    scale = height / (high.z - low.z)
    for vertex in obj.data.vertices:
        vertex.co = (vertex.co - pivot) * scale
    obj.data.update()


def polygon_budget(obj, limit):
    obj.data.calc_loop_triangles()
    count = len(obj.data.loop_triangles)
    if count <= limit:
        return
    simplifier = obj.modifiers.new("Browser polygon budget", "DECIMATE")
    simplifier.ratio = limit / count
    bpy.ops.object.modifier_apply(modifier=simplifier.name)


def shrink_textures():
    for image in bpy.data.images:
        width, height = image.size
        limit = 256 if "bark_normaltree_normal" in image.name.lower() else 384
        if max(width, height) <= limit:
            continue
        ratio = limit / max(width, height)
        image.scale(round(width * ratio), round(height * ratio))
        image.pack()

    packed_images = {}
    for image in list(bpy.data.images):
        if not image.packed_file:
            continue
        key = (sha256(image.packed_file.data).digest(), image.colorspace_settings.name)
        if key in packed_images:
            image.user_remap(packed_images[key])
            bpy.data.images.remove(image)
        else:
            packed_images[key] = image


def distant_mesh(obj, name, limit):
    low = obj.copy()
    low.data = obj.data.copy()
    low.name = f"{name}LOD"
    low.data.name = low.name
    bpy.context.collection.objects.link(low)
    bpy.ops.object.select_all(action="DESELECT")
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    polygon_budget(low, limit)
    low.data.calc_loop_triangles()
    print(f"{low.name}: {len(low.data.loop_triangles)} triangles")


def main(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name, (height, triangles, mesh_name) in SOURCE_MODELS.items():
        mesh = isolate_mesh(source / f"{name}.glb", mesh_name)
        set_ground_pivot(mesh, height)
        polygon_budget(mesh, triangles)
        mesh.name = name
        mesh.data.name = name
        mesh.data.calc_loop_triangles()
        print(f"{name}: {len(mesh.data.loop_triangles)} triangles, {height:.2f} m")
        if name in DISTANT_BUDGETS:
            distant_mesh(mesh, name, DISTANT_BUDGETS[name])
    shrink_textures()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB",
                              export_apply=True, export_all_vertex_colors=True,
                              export_meshopt_compression_enable=True)


if __name__ == "__main__":
    main(Path(sys.argv[sys.argv.index("--") + 1]).resolve())
