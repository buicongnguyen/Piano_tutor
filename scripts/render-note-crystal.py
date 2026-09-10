"""Render an original transparent 3D crystal for live note bursts."""
import bpy, math
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
crystal = bpy.context.object
crystal.name = 'Note crystal'
crystal.scale = (.65, .65, 1.45)
crystal.rotation_euler = (.2, .35, .3)
mat = bpy.data.materials.new('Polished cyan crystal')
mat.use_nodes = True
p = mat.node_tree.nodes.get('Principled BSDF')
p.inputs['Base Color'].default_value = (.025, .6, .85, 1)
p.inputs['Metallic'].default_value = .65
p.inputs['Roughness'].default_value = .2
crystal.data.materials.append(mat)
for position, power, color in [((3,-4,5),900,(.6,.95,1)),((-3,-1,2),650,(.05,.4,1)),((1,3,3),1300,(.8,1,1))]:
    bpy.ops.object.light_add(type='AREA', location=position)
    light=bpy.context.object; light.data.energy=power; light.data.color=color; light.data.shape='DISK'; light.data.size=3
    light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-6,2.5))
camera=bpy.context.object
camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=3.6
scene=bpy.context.scene; scene.camera=camera
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.film_transparent=True
scene.render.resolution_x=192; scene.render.resolution_y=192; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.filepath=str(root/'public/art/note-crystal.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/note-crystal.blend'))
bpy.ops.render.render(write_still=True)
