"""Mesh helpers for the festival's original Blender models."""

from math import cos, pi, sin

import bpy
from mathutils import Vector


def tint(hex_color, factor=1.0):
    red, green, blue = (int(hex_color[index:index + 2], 16) / 255 for index in (0, 2, 4))
    return tuple((value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4)
                 * factor for value in (red, green, blue)) + (1.0,)


def palette_material(name, roughness, metalness=0, emission=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metalness
    colors = material.node_tree.nodes.new("ShaderNodeVertexColor")
    colors.layer_name = "Pigment"
    material.node_tree.links.new(colors.outputs["Color"], shader.inputs["Base Color"])
    if emission:
        shader.inputs["Emission Color"].default_value = tint(emission)
        shader.inputs["Emission Strength"].default_value = 1.35
    return material


class Model:
    def __init__(self, seed):
        from random import Random
        self.random = Random(seed)
        self.points = []
        self.faces = []
        self.colors = []
        self.finishes = []
        self.smooth = []

    def face(self, indices, color, finish=0, smooth=False):
        self.faces.append(indices)
        self.colors.append(color)
        self.finishes.append(finish)
        self.smooth.append(smooth)

    def panel(self, points, color, finish=0, smooth=False):
        first = len(self.points)
        self.points.extend(points)
        self.face(list(range(first, len(self.points))), color, finish, smooth)

    def loft(self, rings, color, finish=0, shade=0.0, cap=True, smooth=True):
        start = len(self.points)
        sides = len(rings[0])
        for ring in rings:
            self.points.extend(ring)
        for row in range(len(rings) - 1):
            for side in range(sides):
                lower = start + row * sides
                following = (side + 1) % sides
                self.face([lower + side, lower + following, lower + following + sides, lower + side + sides],
                          tint(color, self.random.uniform(1 - shade, 1 + shade)), finish, smooth)
        if cap:
            top = start + (len(rings) - 1) * sides
            self.face(list(reversed(range(start, start + sides))), tint(color, 0.62), finish)
            self.face(list(range(top, top + sides)), tint(color, 1.06), finish)

    def turning(self, x, y, profile, color, sides=12, aspect=1.0, finish=0, shade=0.05):
        rings = [[(x + radius * cos(angle), y + aspect * radius * sin(angle), z)
                  for angle in (2 * pi * step / sides for step in range(sides))]
                 for z, radius in profile]
        self.loft(rings, color, finish, shade)

    def timber(self, x, y, z, width, depth, height, color, bevel=0.07, finish=0):
        edge = min(bevel, width / 4, depth / 4, height / 3)
        def outline(w, d, level, corner):
            w, d = w / 2, d / 2
            return [(x + px, y + py, level) for px, py in [
                (-w + corner, -d), (w - corner, -d), (w, -d + corner), (w, d - corner),
                (w - corner, d), (-w + corner, d), (-w, d - corner), (-w, -d + corner),
            ]]
        rings = [
            outline(width - edge, depth - edge, z, edge * 0.6),
            outline(width, depth, z + edge, edge),
            outline(width, depth, z + height - edge, edge),
            outline(width - edge, depth - edge, z + height, edge * 0.6),
        ]
        self.loft(rings, color, finish, shade=0.035, smooth=False)

    def tube(self, points, radii, color, sides=7, finish=0):
        sections = []
        spine = [Vector(point) for point in points]
        for index, point in enumerate(spine):
            direction = (spine[min(len(spine) - 1, index + 1)] - spine[max(0, index - 1)]).normalized()
            ref = Vector((0, 0, 1)) if abs(direction.z) < 0.92 else Vector((0, 1, 0))
            normal = ref.cross(direction).normalized()
            binormal = direction.cross(normal)
            radius = radii[index] if isinstance(radii, (tuple, list)) else radii
            sections.append([tuple(point + (normal * cos(angle) + binormal * sin(angle)) * radius)
                             for angle in (2 * pi * step / sides for step in range(sides))])
        self.loft(sections, color, finish, smooth=True)

    def petal(self, x, y, z, angle, length, width, rise, colors, folded=False):
        first = len(self.points)
        for row in range(6):
            t = row / 5
            blade = width * (0.08 + 0.88 * sin(pi * t ** 0.82))
            for u in (-1, -0.5, 0, 0.5, 1):
                forward = length * (t + (0.13 if folded else 0.02) * sin(pi * t) * (1 - abs(u)))
                side = blade * u
                tip = z + rise * t ** 1.7 + width * (0.28 if folded else 0.10) * (1 - abs(u)) * sin(pi * t)
                self.points.append((x + forward * cos(angle) - side * sin(angle),
                                    y + forward * sin(angle) + side * cos(angle), tip))
        for row in range(5):
            for col in range(4):
                i = first + row * 5 + col
                color = colors[min(len(colors) - 1, (row * len(colors)) // 5)]
                shade = 0.83 if col in (0, 3) else 1.04
                self.face([i, i + 5, i + 6, i + 1], tint(color, shade), smooth=True)

    def finish(self, name, materials):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.points, [], self.faces)
        mesh.update()
        for material in materials:
            mesh.materials.append(material)
        colors = mesh.color_attributes.new(name="Pigment", type="FLOAT_COLOR", domain="CORNER")
        for polygon in mesh.polygons:
            polygon.material_index = self.finishes[polygon.index]
            polygon.use_smooth = self.smooth[polygon.index]
            for loop in polygon.loop_indices:
                colors.data[loop].color = self.colors[polygon.index]
        mesh.color_attributes.active_color = colors
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj
