"""Generate the original Thai festival GLBs in Blender.

Run blender --background --python tools/art/build_festival_kit.py
from any directory. All model origins reference the ground or waterline.
"""

from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))

from kit_geometry import Model, palette_material, tint


OUTPUT = Path(__file__).resolve().parents[2] / "public" / "models" / "festival"
WOOD = ("724638", "8b5640", "a66847", "9f674d", "815342", "b27850")
ROOF = ("a4483d", "b65c44", "a85242", "c36b4d", "9e413d", "bb604d")
GOLD = "e0ae62"
DARK = "543838"


def deck(model, width, depth, height, rows, y=0):
    for row in range(rows):
        length = depth / rows
        offset = -depth / 2 + (row + 0.5) * length + y
        plank_width = width - model.random.uniform(0.01, 0.07)
        model.timber(0, offset, height - 0.092, plank_width, length - 0.014, 0.092,
                     WOOD[row % len(WOOD)], 0.025)


def timber_post(model, x, y, bottom, height, radius=0.18):
    model.turning(x, y, [
        (bottom, radius * 1.25), (bottom + 0.12, radius * 1.17),
        (bottom + 0.20, radius * 0.91), (bottom + height * 0.65, radius * 0.83),
        (bottom + height - 0.13, radius), (bottom + height, radius * 1.21),
    ], "885a45", 8, shade=0.13)
    for level in (bottom + 0.10, bottom + height - 0.14):
        model.turning(x, y, [(level, radius * 1.15), (level + 0.065, radius * 1.15)],
                      GOLD, 8, finish=1)
    for angle in (0, pi / 2, pi, pi * 1.5):
        tx, ty = x + cos(angle) * radius * 0.83, y + sin(angle) * radius * 0.83
        model.tube([(tx, ty, bottom + height * 0.48), (tx, ty, bottom + height * 0.79),
                    (tx + cos(angle) * 0.026, ty + sin(angle) * 0.026, bottom + height * 0.87)],
                   [0.008, 0.026, 0.010], "c49158", 5)


def roof(model, width, depth, eave, rise, rows=8, columns=18, accent=ROOF, ornaments=True):
    def point(side, u, v, offset=0):
        x = side * u * width
        y = (2 * v - 1) * depth * (0.91 + 0.09 * u)
        z = eave + rise * max(0, 1 - u) ** 1.57 + 0.16 * u ** 9 + 0.13 * (2 * v - 1) ** 6 + offset
        return (x, y, z)

    underside = [point(1, 1, 0, -0.11), point(-1, 1, 0, -0.11),
                 point(-1, 1, 1, -0.11), point(1, 1, 1, -0.11)]
    model.panel(underside, tint(DARK))
    for side in (-1, 1):
        for row in range(rows):
            u0 = row / rows
            u1 = (row + 1) / rows
            for column in range(columns):
                v0 = column / columns
                v1 = (column + 1) / columns
                tone = accent[model.random.randrange(len(accent))]
                # Shallow ridges and uneven scalloped lower edges read as terracotta tiles.
                for band in range(3):
                    t0 = band / 3
                    t1 = (band + 1) / 3
                    v0b = v0 + (v1 - v0) * t0
                    v1b = v0 + (v1 - v0) * t1
                    crown0, crown1 = 0.040 * sin(t0 * pi), 0.040 * sin(t1 * pi)
                    tile = [
                        point(side, u0, v0b, crown0),
                        point(side, min(1.013, u1 + crown0 * 0.59), v0b, crown0 + 0.020),
                        point(side, min(1.013, u1 + crown1 * 0.59), v1b, crown1 + 0.020),
                        point(side, u0, v1b, crown1),
                    ]
                    model.panel(tile if side > 0 else tile[::-1], tint(tone, 0.97 + crown0), smooth=True)
        for end in (0, 1):
            edge = [point(side, i / 20, end, 0.025) for i in range(21)]
            edge_raise = edge[-1]
            if ornaments:
                edge.extend([
                    (edge_raise[0] + side * 0.19, edge_raise[1], edge_raise[2] + 0.24),
                    (edge_raise[0] + side * 0.10, edge_raise[1], edge_raise[2] + 0.49),
                    (edge_raise[0] - side * 0.05, edge_raise[1], edge_raise[2] + 0.51),
                ])
            model.tube(edge, [0.058] * (len(edge) - 3) + [0.082, 0.05, 0.012], GOLD, finish=1)
        model.tube([point(side, 1, i / 16, -0.016) for i in range(17)], 0.062, "d48359", finish=1)

    for sign in (-1, 1):
        y = sign * depth * 0.914
        border = [point(-1, i / 12, (sign + 1) / 2, -0.07) for i in range(12, -1, -1)]
        border += [point(1, i / 12, (sign + 1) / 2, -0.07) for i in range(1, 13)]
        center = (0, y, eave + 0.06)
        for i in range(len(border) - 1):
            a, b = border[i], border[i + 1]
            points = [center, (a[0], y, a[2]), (b[0], y, b[2])]
            model.panel(points if sign < 0 else points[::-1], tint("834843", 0.87 + (i % 4) * 0.07))
        model.tube([(-width * 0.97, y, eave + 0.12), (0, y, eave + 0.12),
                    (width * 0.97, y, eave + 0.12)], 0.052, GOLD, finish=1)
        if ornaments:
            tips = [
                (0, sign * depth * 0.91, eave + rise + 0.13),
                (0, sign * depth * 0.99, eave + rise + 0.34),
                (0, sign * depth * 0.99, eave + rise + 0.65),
                (0, sign * depth * 0.91, eave + rise + 0.90),
                (0, sign * depth * 0.98, eave + rise + 1.08),
            ]
            model.tube(tips, [0.13, 0.106, 0.068, 0.035, 0.008], GOLD, 8, finish=1)
            for flank in (-1, 1):
                for index in range(5):
                    start = (index + 0.7) / 5.8
                    x = flank * width * start * 0.64
                    border_y = y + sign * 0.065
                    height = rise * (1 - start) * 0.60
                    model.tube([(x * 1.13, border_y, eave + 0.18),
                                (x, border_y, eave + 0.18 + height * 0.54),
                                (x * 0.63, border_y, eave + 0.18 + height),
                                (x * 0.39, border_y, eave + 0.18 + height * 0.86)],
                               [0.025, 0.049, 0.035, 0.008], GOLD, 5, finish=1)
    model.tube([point(1, 0, i / 16, 0.055) for i in range(17)], 0.075, "d9a66a", finish=1)


def lantern(model, x=0, y=0, z=0, scale=1.0):
    profile = [(z + h * scale, r * scale) for h, r in [
        (-0.36, 0.11), (-0.27, 0.25), (-0.12, 0.34), (0.14, 0.34),
        (0.31, 0.22), (0.39, 0.10),
    ]]
    model.turning(x, y, profile, "ffd494", 8, finish=2, shade=0.14)
    for index in range(8):
        angle = (index + 0.0) * pi / 4
        model.tube([(x + (r + 0.004) * cos(angle), y + (r + 0.004) * sin(angle), h)
                    for h, r in profile], 0.014 * scale, "a66a37", 5, finish=1)
    for dz, r in [(-0.32, 0.19), (0.345, 0.17)]:
        model.turning(x, y, [(z + dz * scale, r * scale),
                             (z + (dz + 0.042) * scale, r * scale)], GOLD, 8, finish=1)
    model.tube([(x, y, z - 0.34 * scale), (x + 0.025 * scale, y, z - 0.47 * scale),
                (x + 0.035 * scale, y, z - 0.55 * scale)], [0.02 * scale, 0.036 * scale, 0.011 * scale],
               "cb6252", 6)


def sala():
    model = Model(146)
    model.timber(0, 0, 0.007, 7.76, 5.45, 0.25, "8d7773", 0.12)
    model.timber(0, 0, 0.16, 7.59, 5.29, 0.11, "c59e7c", 0.048)
    deck(model, 7.52, 5.30, 0.34, 25)
    for row in range(3):
        model.timber(0, -2.64 - 0.29 * row, 0.015, 3.12 + row * 0.22, 0.63,
                     0.27 - 0.075 * row, "a89382", 0.062)
    for x in (-3.52, 3.52):
        for y in (-2.35, 0, 2.35):
            timber_post(model, x, y, 0.34, 2.80, 0.22)
            model.tube([(x, y, 2.39), (x * 0.94, y, 2.81), (x * 0.89, y, 3.01)],
                       [0.088, 0.086, 0.041], "bd8b56", 7, finish=1)
        for z in (0.54, 1.28):
            model.timber(x, 0, z, 0.17, 4.76, 0.12, WOOD[1], 0.045)
        for index in range(13):
            y = -2.21 + index * 0.37
            model.turning(x, y, [(0.62, 0.044), (0.78, 0.069), (0.97, 0.068), (1.25, 0.04)],
                          "b68252", 7)
    for y in (-2.35, 2.35):
        model.timber(0, y, 2.86, 7.52, 0.22, 0.25, WOOD[0], 0.06)
        for j in range(12):
            x = -3.12 + j * 0.57
            model.panel([(x - 0.19, y - 0.13, 2.95), (x, y - 0.14, 2.87),
                         (x + 0.19, y - 0.13, 2.95), (x, y - 0.13, 3.04)],
                        tint(GOLD), finish=1)
    roof(model, 4.59, 3.30, 2.94, 1.91, 8, 21)
    roof(model, 3.6, 3.04, 3.77, 2.06, 7, 19)
    for x in (-2.45, 2.45):
        model.tube([(x, -2.43, 2.98), (x, -2.43, 2.55)], 0.015, "815337", 5)
        lantern(model, x, -2.43, 2.18, 0.82)
    return model


def basket(model, x, y, z, size, produce):
    model.turning(x, y, [(z, size * 0.65), (z + size * 0.25, size * 0.76),
                         (z + size * 0.56, size)], "b78a52", 14, shade=0.15)
    for dz in (0.14, 0.36, 0.56):
        radius = size * (0.65 + dz * 0.64)
        model.turning(x, y, [(z + size * dz, radius), (z + size * dz + 0.021, radius)],
                      "d2a970", 14, shade=0.08)
    if produce == "lotus":
        for j in range(4):
            angle = j * pi / 2
            bloom(model, x + 0.36 * size * cos(angle), y + 0.36 * size * sin(angle),
                  z + size * (0.58 + j * 0.085), size * 0.57, "pink")
    elif produce == "leaf":
        for j in range(7):
            angle = j * pi * 2 / 7
            model.petal(x, y, z + size * 0.54, angle, size * 0.86, size * 0.35,
                        size * (0.14 + 0.14 * (j % 3)), ("4b813d", "719a49", "adbd63"))
    elif produce == "incense":
        for j in range(13):
            tx = x + size * model.random.uniform(-0.45, 0.45)
            ty = y + size * model.random.uniform(-0.45, 0.45)
            model.tube([(tx, ty, z + size * 0.42), (tx + 0.06, ty + 0.04, z + size * 1.25)],
                       [0.018, 0.013], "bd6d4e", 5)


def shop(florist):
    model = Model(82 if florist else 96)
    accent = ("667f78", "789386", "82978a", "587b72") if florist else (
        "ae6a48", "b77f4b", "a56b44", "c08753")
    deck(model, 6.76, 3.58, 0.12, 16)
    for x in (-3.10, 3.10):
        for y in (-1.29, 1.49):
            timber_post(model, x, y, 0.08, 2.45, 0.16)
            model.tube([(x, y, 1.94), (x * 0.91, y, 2.34), (x * 0.76, y, 2.45)],
                       [0.06, 0.065, 0.041], "bf976b", 7)
    for j in range(24):
        x = -3.12 + j * 0.27
        model.timber(x, 1.49, 0.16, 0.26, 0.12, 2.14, WOOD[(j + 2) % len(WOOD)], 0.032)
    for level in (0.46, 1.12, 1.72):
        model.timber(0, 1.10, level, 5.95, 0.64, 0.09, WOOD[0], 0.033)
        for index in range(9):
            x = -2.61 + index * 0.62
            jar = 0.10 + (index * 3 % 5) * 0.025
            model.turning(x, 1.12, [(level + 0.09, jar * 0.66), (level + 0.17, jar),
                                    (level + 0.31, jar * 0.83), (level + 0.36, jar * 0.60),
                                    (level + 0.39, jar * 0.89)],
                          ("a16a5d", "dab88d", "6b9b89", "bd8b62")[index % 4], 9)
    for index in range(22):
        model.timber(-2.83 + index * 0.27, -1.45, 0.13, 0.255, 0.13, 0.82,
                     WOOD[(index + 1) % len(WOOD)], 0.023)
    model.timber(0, -1.27, 0.91, 6.25, 0.84, 0.15, "b67e51", 0.065)
    for index, x in enumerate((-2.55, -1.73, -0.76, 0.58, 1.60, 2.49)):
        detail = ("lotus", "leaf", "lotus")[index % 3] if florist else "incense"
        basket(model, x, -1.32, 1.06, 0.30 + 0.08 * (index % 2), detail)
    model.timber(0, -1.56, 2.39, 3.22, 0.16, 0.39,
                 "607a68" if florist else "ab654d", 0.09)
    for i in range(5):
        x = (i - 2) * 0.48
        model.panel([(x - 0.14, -1.655, 2.57), (x, -1.65, 2.45), (x + 0.14, -1.655, 2.57),
                     (x, -1.65, 2.69)], tint(GOLD), finish=1)
    roof(model, 3.72, 2.12, 2.51, 1.46, 7, 15, accent)
    for index in range(9):
        begin = -3.35 + index * 0.743
        end = begin + 0.72
        tones = ("d6b179", "bf7b58", "8e9674") if florist else ("deb17a", "a26752", "b5895a")
        panel = [(begin, -1.70, 2.35), (end, -1.70, 2.35), (end, -1.78, 1.98),
                 ((begin + end) / 2, -1.83, 1.90 - 0.04 * (index % 2)), (begin, -1.78, 1.98)]
        model.panel(panel, tint(tones[index % 3]))
        model.panel(panel[::-1], tint(tones[index % 3], 0.73))
        model.tube(panel[2:], 0.016, GOLD, 5)
    for x in (-2.75, 2.75):
        lantern(model, x, -1.85, 2.06, 0.61)
    return model


def craft_bench():
    model = Model(255)
    for x in (-2.25, 2.25):
        for y in (-0.85, 0.85):
            timber_post(model, x, y, 0.02, 0.96, 0.14)
    deck(model, 5.62, 2.38, 1.030, 11)
    for x in (-2.35, 2.35):
        model.timber(x, 0, 0.23, 0.13, 2.10, 0.19, WOOD[1], 0.025)
    model.timber(0, 0.03, 1.034, 2.10, 2.28, 0.035, "ae665e", 0.018)
    basket(model, -1.86, 0.36, 1.04, 0.38, "leaf")
    basket(model, 1.88, 0.30, 1.04, 0.36, "lotus")
    basket(model, -2.08, -0.52, 1.04, 0.28, "incense")
    return model


def distant_shop():
    model = Model(73)
    deck(model, 6.76, 3.58, 0.12, 6)
    for x in (-3.10, 3.10):
        for y in (-1.29, 1.49):
            timber_post(model, x, y, 0.08, 2.45, 0.16)
    model.timber(0, 1.49, 0.16, 6.39, 0.12, 2.14, WOOD[1], 0.045)
    model.timber(0, -1.27, 0.13, 6.25, 0.61, 0.9, WOOD[3], 0.065)
    roof(model, 3.72, 2.12, 2.51, 1.46, 4, 6, ("667f78", "82978a", "587b72"))
    for x in (-2.64, 2.64):
        lantern(model, x, -1.75, 1.96, 0.53)
    return model


def arch():
    model = Model(11)
    for x in (-3.8, 3.8):
        timber_post(model, x, 0, 0, 4.04, 0.23)
        model.timber(x, 0, 0.012, 0.83, 0.83, 0.18, "8c8373", 0.10)
        model.tube([(x, 0, 2.96), (x * 0.88, 0, 3.57), (x * 0.72, 0, 3.90)],
                   [0.09, 0.095, 0.05], WOOD[1], 8)
    for y in (-0.30, 0.30):
        arc = [(x * 0.25, y, 4.14 + cos(x * pi / 32) * 0.35) for x in range(-17, 18)]
        model.tube(arc, 0.15, WOOD[2], 8)
        model.tube([(x, yy, z + 0.13) for x, yy, z in arc], 0.044, GOLD, 6, finish=1)
    for x in (-3.3, -1.65, 0, 1.65, 3.3):
        length = 0.38 + 0.51 * (1 - abs(x) / 3.5)
        top = 4.22 + 0.27 * cos(x * pi / 8)
        model.tube([(x, 0, top), (x, 0, top - length)], 0.016, DARK, 5)
        lantern(model, x, 0, top - length - 0.30, 0.71 + (1 - abs(x) / 3.5) * 0.16)
    return model


def lamp_post():
    model = Model(89)
    model.turning(0, 0, [(0.0, 0.28), (0.07, 0.28), (0.17, 0.19), (0.22, 0.16)], "a39a82", 8)
    timber_post(model, 0, 0, 0.21, 0.80, 0.10)
    lantern(model, 0, 0, 1.06, 0.63)
    return model


def ceremony_post():
    model = Model(33)
    model.turning(0, 0, [(0, 0.35), (0.12, 0.35), (0.24, 0.28)], "8f8b80", 10)
    timber_post(model, 0, 0, 0.24, 2.37, 0.125)
    model.tube([(0, 0, 2.51), (0, 0.25, 2.73), (0, 0.62, 2.69), (0, 0.66, 2.47)],
               [0.084, 0.075, 0.051, 0.022], "bd8f57", 8, finish=1)
    return model


def pier():
    model = Model(74)
    deck(model, 9.22, 9.80, 0.2, 34)
    for x in (-4.38, 4.38):
        for y in (-4.44, -2.2, 0, 2.23, 4.42):
            timber_post(model, x, y, -0.73, 1.83, 0.17)
        for z in (0.44, 0.94):
            model.tube([(x, -3.0, z), (x, 0, z), (x, 4.46, z)], 0.082, WOOD[2], 8)
        for y in (-3.1, -2.57, -2.0, -1.4, -0.8, -0.2, 0.40, 1.0, 1.6, 2.2, 2.8, 3.4, 4.0):
            model.tube([(x, y, 0.23), (x, y, 0.96)], [0.052, 0.044], WOOD[3], 6)
    for y in (-4.30, -2.24, 0.06, 2.45, 4.33):
        model.timber(0, y, -0.15, 9.29, 0.36, 0.25, WOOD[0], 0.054)
    # Open river-facing end leaves room for the ceremony and floating offerings.
    for x in (-3.14, 3.14):
        lantern(model, x, -4.40, 0.65, 0.55)
        model.turning(x, -4.40, [(0.19, 0.27), (0.23, 0.26), (0.39, 0.12)], "c7a16e", 10)
    for j in range(13):
        y = -4.5 + j * 0.69
        model.panel([(-0.85, y - 0.16, 0.205), (0, y - 0.35, 0.205),
                     (0.85, y - 0.16, 0.205), (0, y + 0.07, 0.205)],
                    tint("a56d50", 0.78 + j * 0.025))
    return model


def bridge():
    model = Model(78)
    for row in range(23):
        y = -2.34 + row * 0.21
        y_scale = min(1.0, abs(y) / 2.50)
        height = 0.11 + 0.13 * (1 - y_scale ** 2)
        model.timber(0, y, height - 0.085, 2.75, 0.205, 0.085, WOOD[row % len(WOOD)], 0.023)
    for x in (-1.28, 1.28):
        rail = [(x, y / 4, 0.92 + 0.23 * (1 - (y / 10) ** 2)) for y in range(-10, 11)]
        model.tube(rail, 0.085, WOOD[3], 8)
        for y in (-2.38, -1.27, 0, 1.27, 2.38):
            timber_post(model, x, y, -0.22, 1.14 + 0.15 * (1 - abs(y) / 2.50), 0.106)
    return model


def boat():
    model = Model(86)
    profiles = []
    for i in range(17):
        y = 4.2 * (i / 16 - 0.5)
        arc = 0.43 * (abs(y) / 2.12) ** 3
        width = 0.07 + 0.71 * sin(i * pi / 16) ** 0.9
        profiles.append([(width * cos(angle), y, 0.13 + arc + abs(cos(angle)) * 0.22)
                         for angle in (pi + step * pi / 8 for step in range(9))])
    for row in range(len(profiles) - 1):
        for band in range(8):
            quad = [profiles[row][band], profiles[row][band + 1],
                    profiles[row + 1][band + 1], profiles[row + 1][band]]
            color = WOOD[(band + 2) % len(WOOD)]
            model.panel(quad, tint(color))
            model.panel(quad[::-1], tint(color, 0.68))
    for edge in (0, 8):
        model.tube([p[edge] for p in profiles], 0.043, "d29560", 7)
    for y in (-1.14, 0, 1.16):
        model.timber(0, y, 0.24, 1.03, 0.24, 0.082, WOOD[2], 0.043)
    model.tube([(0.19, 0.7, 0.36), (0.44, 1.43, 0.59), (0.63, 2.13, 0.62)],
               [0.03, 0.03, 0.085], WOOD[4], 7)
    basket(model, -0.16, -0.52, 0.28, 0.27, "lotus")
    return model


def bloom(model, x, y, z, size, variant):
    palettes = {
        "pink": ("9f4565", "e27e9c", "fbb3c9", "ffe0d4"),
        "gold": ("a75736", "dd833c", "efad54", "ffe398"),
        "rose": ("903f58", "b95162", "e47a78", "f6a790"),
    }
    colors = palettes[variant]
    for row, count in enumerate((9, 7, 5)):
        for index in range(count):
            angle = 2 * pi * index / count + row * 0.39
            length = size * (1 - row * 0.19)
            model.petal(x + cos(angle) * size * 0.08, y + sin(angle) * size * 0.08,
                        z + row * size * 0.12, angle, length, length * 0.34,
                        size * (0.26 + row * 0.13), colors)
    model.turning(x, y, [(z, size * 0.22), (z + size * 0.43, size * 0.23),
                         (z + size * 0.53, size * 0.10)], "eecc72", 12)


def lotus():
    model = Model(355)
    for index, (x, y, height, scale) in enumerate([
        (0, 0, 0.63, 0.39), (-0.52, -0.27, 0.39, 0.27), (0.47, 0.24, 0.48, 0.33),
    ]):
        stem = [(x * 0.83, y, -0.12), (x * 0.88, y - 0.07, height * 0.48), (x, y, height + 0.03)]
        model.tube(stem, [0.032, 0.027, 0.021], "759d56", 6)
        bloom(model, x, y, height, scale, "pink")
        leaf_x = x + cos(index * 2.15) * 0.46
        leaf_y = y + sin(index * 2.15) * 0.46
        for j in range(14):
            a, b = (j + 0.55) * 2 * pi / 15, (j + 1.55) * 2 * pi / 15
            size = 0.37 + index * 0.075
            model.panel([(leaf_x, leaf_y, 0.074), (leaf_x + size * cos(a), leaf_y + size * sin(a), 0.084 + 0.032 * sin(a)),
                         (leaf_x + size * cos(b), leaf_y + size * sin(b), 0.084 + 0.032 * sin(b))],
                        tint(("538a64", "669c6c", "4d825d")[j % 3]))
    return model


def krathong(base):
    model = Model(272 + base)
    base_tones = ("537447", "a7754a", "ae7f55")
    profile = [(-0.09, 0.34), (-0.042, 0.50), (0.09, 0.55), (0.22, 0.49), (0.26, 0.40)]
    if base == 2:
        rings = []
        for level, radius in profile:
            ring = []
            for j in range(36):
                a = j / 36 * 2 * pi
                x = sin(a) ** 3
                y = (13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a)) / 16
                ring.append((-radius * x, radius * y, level))
            rings.append(ring)
        model.loft(rings, base_tones[base], shade=0.09)
    else:
        model.turning(0, 0, profile, base_tones[base], 28, shade=0.14)
    for layer, count in enumerate((15, 12)):
        for index in range(count):
            a = 2 * pi * (index + 0.5 * layer) / count
            radius = 0.36 - layer * 0.071
            colors = ("405e37", "538943", "85a352", "b2c36f") if base == 0 else (
                "536540", "769451", "b09a58", "d5b878")
            model.petal(radius * cos(a), radius * sin(a), 0.12 + layer * 0.087,
                        a, 0.21 - layer * 0.026, 0.103, 0.21 + layer * 0.032, colors, folded=True)
    model.turning(0.04, -0.11, [(0.25, 0.079), (0.35, 0.075), (0.53, 0.073),
                              (0.62, 0.069), (0.64, 0.039)], "f6dfa2", 12)
    model.tube([(0.04, -0.11, 0.627), (0.046, -0.103, 0.666)], 0.010, "75564a", 6)
    for index in range(3):
        x = -0.16 + 0.14 * index
        model.tube([(x, 0.14, 0.25), (x - 0.06 + 0.034 * index, 0.24, 0.72 + index * 0.04)],
                   [0.016, 0.012], "b46a53", 5)
    return model


def flower_crown(variant):
    model = Model(63)
    for index in range(6):
        angle = 2 * pi * index / 6
        bloom(model, cos(angle) * 0.29, sin(angle) * 0.29, 0.30 + 0.027 * (index % 3),
              0.102 + 0.026 * (index % 2), variant)
    return model


def export(name, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / name), export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_all_vertex_colors=True, export_extras=False,
                              export_meshopt_compression_enable=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    materials = [palette_material("Painted wood, stone and leaves", 0.76),
                 palette_material("Satin lacquer and brass", 0.41, 0.18),
                 palette_material("Warm lantern paper", 0.83, emission="ffad62")]
    architecture = {
        "Sala": sala(), "FlowerStall": shop(True), "IncenseStall": shop(False),
        "LanternGate": arch(), "CraftBench": craft_bench(), "Pier": pier(), "Bridge": bridge(),
        "DistantStall": distant_shop(),
    }
    paper = Model(37)
    lantern(paper)
    props = {
        "PaperLantern": paper, "LampPost": lamp_post(), "CeremonyPost": ceremony_post(),
        "Lotus": lotus(), "Longboat": boat(), "BananaKrathong": krathong(0),
        "CoconutKrathong": krathong(1), "HeartKrathong": krathong(2),
        "LotusCrown": flower_crown("pink"), "MarigoldCrown": flower_crown("gold"),
        "RoseCrown": flower_crown("rose"),
    }
    export("architecture.glb", [model.finish(name, materials) for name, model in architecture.items()])
    export("offerings.glb", [model.finish(name, materials) for name, model in props.items()])


if __name__ == "__main__":
    main()
