"""Original Stillnote diorama. Run with Blender --background --python this_file."""
import bpy, math, random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'art'
OUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'art').mkdir(exist_ok=True)
random.seed(18)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0, rough=.55, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m
ground=material('Midnight moss',(.025,.09,.10))
rock=material('Distant blue slate',(.04,.10,.17))
water=material('Turquoise river',(.015,.32,.40),.55,.24)
rim=material('Cyan rim light',(.03,.7,.9),.3,.35,2)
wood=material('Warm cedar stage',(.20,.12,.075))
body=material('Piano graphite',(.015,.023,.035),.6,.25)
ivory=material('Ivory key tops',(.85,.9,.9),.12,.3)
black=material('Ebony keys',(.009,.013,.02),.2,.3)
gold=material('Lantern light',(1,.55,.12),0,.4,4)
moon=material('Moon',(.65,.85,1),0,.8,2)

def cube(name,loc,scale,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=bevel;mod.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def cone(name,loc,radius,depth,mat,vertices=7):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=0,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat);return o
def light(name,loc,color,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector((0,1,0))-obj.location).to_track_quat('-Z','Y').to_euler()

cube('Landscape foundation',(0,4,-.7),(48,45,1),ground)
# A continuous winding river ribbon, with narrow luminous banks.
for strip,offset,width,mat in [('River',0,4.7,water),('Left bank',-2.5,.09,rim),('Right bank',2.5,.09,rim)]:
    verts=[]
    for i in range(65):
        y=-15+i*.65;x=-3+math.sin(y*.19)*3.3+offset
        verts += [(x-width/2,y,-.16),(x+width/2,y,-.16)]
    mesh=bpy.data.meshes.new(strip);mesh.from_pydata(verts,[],[(2*i,2*i+1,2*i+3,2*i+2) for i in range(64)])
    obj=bpy.data.objects.new(strip,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
for i in range(22):
    x=random.uniform(-23,23); y=random.uniform(12,24); h=random.uniform(4,10)
    cone('Faceted mountain', (x,y,h/2-.4),random.uniform(3,6),h,rock,5)
for i in range(26):
    x=random.choice([-1,1])*random.uniform(7,19);y=random.uniform(-5,15)
    cone('Cypress silhouette',(x,y,.8),.6,2,ground)

# Stage and a modeled 35-white-key digital piano; decorative, not the input surface.
cube('Floating cedar platform',(4,-1,0),(10,5,.35),wood,.16)
for i in range(17):cube('Deck plank',(4,-3.3+i*.28,.19),(9.8,.023,.012),body)
for x in [.6,7.4]:cube('Piano leg',(x,-.1,.8),(.18,.35,1.4),body,.04)
cube('Digital piano cabinet',(4,-.1,1.55),(7.6,1.65,.42),body,.11)
cube('Cyan front trim',(4,-.945,1.45),(7.2,.025,.035),rim,.01)
for i in range(35):
    x=.62+i*.193
    cube('White key %02d'%i,(x,-.49,1.79),(.181,.78,.08),ivory,.012)
    if i%7 not in [2,6] and i<34: cube('Black key %02d'%i,(x+.096,-.25,1.87),(.105,.43,.13),black,.014)
cube('Display recess',(4,.41,1.78),(1.15,.3,.045),black,.025)
cube('Blue LCD',(4,.41,1.81),(.93,.19,.009),rim,.01)
for x in [1.1,6.9]:
    for i in range(10):cube('Speaker grille',(x-.45+i*.1,.39,1.79),(.025,.32,.014),black)
cube('Piano bench',(4,-2, .7),(2.5,.65,.22),body,.07)
for x in [3,5]:cube('Bench leg',(x,-2,.35),(.12,.45,.6),body,.02)

for i,(x,y) in enumerate([(-7,-5),(-7,0),(-5,5),(-1,9),(7,4),(9,-3),(.1,-3)]):
    cube('Lantern base',(x,y,.03),(.6,.6,.12),wood,.05)
    cube('Paper lantern',(x,y,.48),(.42,.42,.7),gold,.08)
    cube('Lantern roof',(x,y,.89),(.65,.65,.09),body,.05)
    for dx in [-.23,.23]:
        for dy in [-.23,.23]:cube('Lantern frame',(x+dx,y+dy,.48),(.035,.035,.77),body)
    light('Lantern pool %s'%i,(x,y,1.4),(1,.46,.1),35,1)
for i in range(24):
    x=random.uniform(-9,10);y=random.uniform(-4,10)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.025,location=(x,y,random.uniform(.4,2.5)))
    bpy.context.object.data.materials.append(gold)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=1.2,location=(-9,15,10))
bpy.context.object.name='Moon';bpy.context.object.data.materials.append(moon)
light('Moonlight',(0,8,15),(.28,.65,1),2600,12)
light('Piano softbox',(4,-6,9),(.5,.8,1),1900,8)
light('Warm edge',(10,1,8),(1,.55,.25),1600,7)

scene=bpy.context.scene
scene.world.color=(.025,.025,.025)
bpy.ops.object.camera_add(location=(15,-23,17))
camera=bpy.context.object;camera.name='Banner camera'
camera.rotation_euler=(Vector((0,2,1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=34;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=520;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.compression=90
scene.view_settings.view_transform='AgX'
scene.use_nodes=True
nodes=scene.node_tree.nodes;nodes.clear()
r=nodes.new('CompositorNodeRLayers');g=nodes.new('CompositorNodeGlare');g.glare_type='FOG_GLOW';g.quality='MEDIUM';g.threshold=1.5
c=nodes.new('CompositorNodeComposite');scene.node_tree.links.new(r.outputs['Image'],g.inputs['Image']);scene.node_tree.links.new(g.outputs['Image'],c.inputs['Image'])
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art'/'moonlit-piano.blend'))
scene.render.filepath=str(OUT/'moonlit-piano.png');bpy.ops.render.render(write_still=True)
scene.render.resolution_percentage=50
scene.render.filepath=str(OUT/'moonlit-piano-mobile.png');bpy.ops.render.render(write_still=True)
