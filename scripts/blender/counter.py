# Modélise un compteur mécanique à rouleaux (FocusFlow, lab 6) et l'exporte en .glb.
# Usage : <venv>/bin/python scripts/blender/counter.py public/lab/counter.glb
# Tout est construit en code : boîtier biseauté avec fenêtre (booléen),
# 4 rouleaux (minutes et secondes) portant les chiffres 0-9 en relief, axe,
# séparateur deux-points. Aucun asset externe (police : Bfont intégrée à Blender).
import math
import sys

import bpy
import bmesh

out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m

M_BODY = mat("body", (0.86, 0.83, 0.77), 0.55)
M_DRUM = mat("drum", (0.06, 0.06, 0.065), 0.35)
M_DIGIT = mat("digit", (0.95, 0.94, 0.9), 0.4)
M_ACCENT = mat("accent", (0.93, 0.42, 0.12), 0.45)

R = 0.62          # rayon des rouleaux
W = 0.52          # largeur d'un rouleau
GAP = 0.08
XS = [-1.05, -0.47, 0.47, 1.05]  # positions des 4 rouleaux (MM SS)

def bevel(obj, width, segs=3):
    m = obj.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segs
    m.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="bevel")

def apply_all(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

# ── Rouleaux avec chiffres en relief ───────────────────────────────────────
for i, x in enumerate(XS):
    bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=R, depth=W, location=(x, 0, 0), rotation=(0, math.pi / 2, 0))
    drum = bpy.context.object
    drum.name = f"drum_{i}"
    bevel(drum, 0.03)
    drum.data.materials.append(M_DRUM)
    digits = []
    for d in range(10):
        bpy.ops.object.text_add()
        t = bpy.context.object
        t.data.body = str(d)
        t.data.size = 0.3
        t.data.extrude = 0.012
        t.data.resolution_u = 3
        t.data.align_x = "CENTER"
        t.data.align_y = "CENTER"
        bpy.ops.object.convert(target="MESH")
        t.data.materials.clear()
        t.data.materials.append(M_DIGIT)
        # Chiffre posé sur la surface du rouleau, face vers l'extérieur.
        a = -d * (2 * math.pi / 10)
        t.rotation_euler = (math.pi / 2 + a, 0, 0)
        t.location = (x, -math.sin(-a + math.pi / 2) * 0, 0)
        t.location = (x, -(R + 0.004) * math.cos(a), (R + 0.004) * math.sin(-a) * -1)
        t.location = (x, -(R + 0.004) * math.cos(a), -(R + 0.004) * math.sin(a))
        digits.append(t)
    bpy.ops.object.select_all(action="DESELECT")
    for t in digits:
        t.select_set(True)
    drum.select_set(True)
    bpy.context.view_layer.objects.active = drum
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Origine sur l'axe du rouleau pour pouvoir le faire tourner.
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

# ── Boîtier : bloc biseauté, fenêtre découpée par booléen ─────────────────
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
body = bpy.context.object
body.name = "body"
body.scale = (3.3, 1.36, 1.75)  # profondeur réduite : les rouleaux affleurent la fenêtre
bpy.ops.object.transform_apply(scale=True)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.62, 0))
cut = bpy.context.object
cut.scale = (2.62, 0.5, 0.66)
bpy.ops.object.transform_apply(scale=True)
bevel(cut, 0.06, 4)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
cavity = bpy.context.object
cavity.scale = (2.7, 1.12, 1.42)
bpy.ops.object.transform_apply(scale=True)
for c in (cut, cavity):
    b = body.modifiers.new("cut", "BOOLEAN")
    b.operation = "DIFFERENCE"
    b.object = c
    b.solver = "EXACT"
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier="cut")
    bpy.data.objects.remove(c)
bevel(body, 0.05, 3)
body.data.materials.append(M_BODY)

# ── Séparateur et repère sodium ────────────────────────────────────────────
for z in (0.14, -0.14):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, segments=24, ring_count=12, location=(0, -R + 0.02, z))
    s = bpy.context.object
    s.name = "colon"
    s.data.materials.append(M_DIGIT)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.69, 0.6))
mark = bpy.context.object
mark.name = "mark"
mark.scale = (0.5, 0.02, 0.06)
bpy.ops.object.transform_apply(scale=True)
bevel(mark, 0.008, 2)
mark.data.materials.append(M_ACCENT)

# Axe
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.05, depth=2.8, location=(0, 0, 0), rotation=(0, math.pi / 2, 0))
axle = bpy.context.object
axle.name = "axle"
axle.data.materials.append(M_DRUM)

for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.shade_smooth_by_angle(angle=math.radians(35)) if hasattr(o.data, "shade_smooth_by_angle") else None

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_yup=True)
tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("OK", out, "polygones", tris)
