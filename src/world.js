import * as T from 'three/webgpu';
import { pass, renderOutput, uniform, vec2, vec3, vec4, float, uv, mix, smoothstep, distance, dot, sin, fract, attribute } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { transparentPass } from './visual/transparent-pass.js';
import { createRenderer, initializeRenderer } from './visual/renderer.js';
import { renderPixelRatio } from './visual/performance.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOXES, MAP, OBJECTIVE, WEAPONS, WEAPON_ORDER, rng } from './shared/data.js';
import { makeMaterials, labelTexture } from './visual/materials.js';
import { ModelKit } from './visual/models.js';
import { SoldierModels } from './visual/characters.js';
import { CombatEffects } from './visual/effects.js';
import { createMuzzleFlash, muzzleScale } from './visual/muzzle-flash.js';
import { loadGeneratedArt } from './visual/generated-art.js';
import { facilityDecals } from './visual/decals.js';
import { buildCover, facilityArchitecture } from './visual/facility-detail.js';
import { loadScannedSurfaces } from './visual/scanned-surfaces.js';
import { atmospherePass } from './visual/atmosphere.js';
import { loadFacilitySurfaces } from './visual/facility-surfaces.js';
import { createWetFloor } from './visual/wet-floor.js';
import { facilitySunShadows } from './visual/sun-shadows.js';
import { captureFacilityProbes } from './visual/facility-probe.js';

export const settingsFov=(fov,zoom)=>T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(fov)/2)/zoom));

export class WorldView {
  constructor(canvas,settings){
    this.settings=settings;this.renderer=createRenderer({canvas,antialias:false});
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.scene=new T.Scene();this.scene.background=new T.Color(0x82979f);this.scene.fog=new T.FogExp2(0x82918e,.006);
    this.camera=new T.PerspectiveCamera(settings.fov,1,.035,150);this.camera.rotation.order='YXZ';
    this.models=new Map();this.recoil=0;this.shake=0;this.shotTimer=0;this.weaponType='';this.smoothPos=null;this.lastRound='';this.sway=new T.Vector2();this.lastLook=null;this.moveBlend=0;
    this.environment=null;
    this.scene.environmentIntensity=.48;
    this.scene.add(new T.HemisphereLight(0xc1d3de,0x4c4337,.62));
    this.sun=new T.DirectionalLight(0xffdfac,4.2);this.sun.position.set(-32,40,-26);this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);
    Object.assign(this.sun.shadow.camera,{left:-52,right:52,top:44,bottom:-44,near:.5,far:150});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.009;this.scene.add(this.sun);
    this.materials=makeMaterials();this.kit=new ModelKit(this.materials);this.facility=new T.Group();this.scene.add(this.facility);this.buildFacility();facilityArchitecture(this);facilityDecals(this.facility);this.batchFacility();
    this.characters=new SoldierModels(this.kit);
    this.ready=initializeRenderer(this.renderer).then(()=>Promise.all([this.characters.ready,loadGeneratedArt(this.materials,this.renderer,{skip:['concrete','floor']})])).then(async([,assets])=>{
      this.artAssets=assets;
      const sleeve=this.characters.sideMaterials[0].get('cloth').clone();sleeve.vertexColors=false;sleeve.name='first-person-uniform';
      this.materials.sleeve.dispose();this.materials.sleeve=sleeve;
      const nylon=this.characters.sideMaterials[0].get('webbing');for(const key of ['map','normalMap','roughnessMap'])this.materials.glovePanel[key]=nylon[key];this.materials.glovePanel.needsUpdate=true;
      this.scannedAssets=await loadScannedSurfaces(this);
      this.facilityAssets=await loadFacilitySurfaces(this);
      this.sunShadowUniforms=facilitySunShadows(this);
      this.sunShadowUniforms.facilityShadowTaps.value=this.settings.quality==='high'?16:10;
      this.facilityProbes=await captureFacilityProbes(this);
      // Allocate every shadow attachment before postprocessing samples it.
      this.wetFloor.visible=false;
      for(const light of [this.sun,this.gunLight,...this.localShadowLights])light.shadow.autoUpdate=true;
      this.renderer.render(this.scene,this.camera);this.renderer.render(this.gunScene,this.gunCamera);
      this.createPostprocessing();this.resize();
    });
    this.gunScene=new T.Scene();this.gunScene.environment=this.environment;this.gunScene.environmentIntensity=.65;
    this.gunScene.add(new T.HemisphereLight(0xc1d4dd,0x484536,.55));const gunLight=new T.DirectionalLight(0xffe2b6,2.2);gunLight.position.set(-2,3,1);gunLight.target.position.set(0,-.1,-.8);gunLight.castShadow=true;gunLight.shadow.mapSize.set(2048,2048);
    Object.assign(gunLight.shadow.camera,{left:-1.3,right:1.3,top:1.3,bottom:-1.3,near:.1,far:8});gunLight.shadow.camera.updateProjectionMatrix();gunLight.shadow.bias=-.0001;gunLight.shadow.normalBias=.0008;this.gunScene.add(gunLight,gunLight.target);this.gunLight=gunLight;
    this.gunCamera=new T.PerspectiveCamera(65,1,.01,10);this.gun=new T.Group();this.gun.scale.setScalar(.82);this.gunScene.add(this.gun);
    this.flash=new T.PointLight(0xffbc75,0,4,2);this.gunScene.add(this.flash);
    this.fx=new CombatEffects(this.scene,settings);this.effects=this.fx.traces;
    this.createDust();this.wetFloor=createWetFloor(this);this.resize();
  }
  box(w,h,d,x,y,z,material,parent=this.facility,r=0){return this.kit.box(parent,w,h,d,x,y,z,material,r);}
  cylinder(r,rt,h,x,y,z,material,parent=this.facility,segments=16){return this.kit.cylinder(parent,r,rt,h,x,y,z,material,segments);}
  sign(title,subtitle,w,x,y,z,rotation=0,color='#c4dcd9'){
    const texture=labelTexture(title,subtitle,color),mesh=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:texture}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;this.facility.add(mesh);return mesh;
  }
  buildFacility(){
    const random=rng(417);
    this.box(MAP.width,.22,MAP.depth,0,-.13,0,'floor');
    // Keep all substantial geometry on the authoritative collision footprints.
    for(const [index,b] of BOXES.entries()){
      const wall=b.h>=3.9,thin=b.w<.6||b.d<.6;
      if(!wall&&!thin){buildCover(this,b,index);continue;}
      this.box(b.w,b.h,b.d,b.x,b.h/2,b.z,wall?'wall':b.h<1?'paintedWall':thin?'concrete':'steel',this.facility,wall?.018:.035);
      this.box(b.w+.018,.14,b.d+.018,b.x,.16,b.z,'dark');
      if(wall){
        this.box(b.w+.018,.84,b.d+.018,b.x,.59,b.z,'paintedWall');
        this.box(b.w+.022,.045,b.d+.022,b.x,1.08,b.z,'steel');this.box(b.w+.025,.1,b.d+.025,b.x,3.75,b.z,'steel');
        const alongX=b.w>b.d,length=alongX?b.w:b.d;
        for(let offset=-length/2+.8;offset<length/2;offset+=2.8){
          this.box(alongX?.095:b.w+.04,3.72,alongX?b.d+.04:.095,b.x+(alongX?offset:0),1.87,b.z+(alongX?0:offset),'steel');
          for(const side of [-1,1]){
            if(length<3)continue;
            this.box(alongX?.75:.012,.22,alongX?.012:.75,b.x+(alongX?offset+.48:side*(b.w/2+.016)),.66,b.z+(alongX?side*(b.d/2+.016):offset+.48),'paintedWall');
          }
        }
      }else{
        this.box(b.w+.03,.065,b.d+.03,b.x,b.h-.04,b.z,'edge');
        for(let y=.5;y<b.h;y+=.8)this.box(b.w+.014,.012,b.d+.014,b.x,y,b.z,'dark');
      }
    }
    // Structural ceiling: steel I-beams, skylight coffers and cable trays.
    for(let x=-MAP.halfWidth+2;x<=MAP.halfWidth-2;x+=4){
      this.box(.12,.42,MAP.depth,x,5.12,0,'steel');this.box(.32,.065,MAP.depth,x,4.94,0,'dark');
      for(let z=-MAP.halfDepth+3;z<=MAP.halfDepth-3;z+=5){
        const glazed=[5,15,25].includes(Math.abs(z))&&Math.round(x+26)%8===0;
        if(glazed){
          // Roof panels surround an actual aperture; glass transmits sunlight.
          for(const dx of [-1.85,1.85])this.box(.3,.08,5,x+dx,5.55,z,'ceiling');
          for(const dz of [-1.925,1.925])this.box(3.4,.08,1.15,x,5.55,z+dz,'ceiling');
          this.box(3.4,.025,2.7,x,5.54,z,'window');
          for(let i=0;i<6;i++)this.box(.035,.09,2.73,x-1.5+i*.6,5.5,z,'steel');
        }else this.box(4,.08,5,x,5.55,z,'ceiling');
      }
      for(const z of [-24,-14,0,14,24]){
        this.box(1.8,.14,.36,x,4.77,z,'steel',this.facility,.025);this.box(1.57,.025,.23,x,4.69,z,'lamp');
        for(const dx of [-.65,.65])this.cylinder(.009,.009,.32,x+dx,5,z,'edge',this.facility,6);
      }
    }
    this.localLights=[];
    for(const [x,z] of [[-22,0],[-10,0],[6,0],[22,0],[-18,-14],[-2,-14],[18,-14],[-14,14],[2,14],[14,14],
      [-35,-20],[-35,0],[-35,20],[35,-20],[35,0],[35,20],[-27,-23],[-15,-23],[0,-23],[16,-23],[28,-23],
      [-27,23],[-16,23],[0,23],[16,23],[28,23]]){
      const light=new T.SpotLight(z<0?0xb8d9ed:z>0?0xffce97:0xe3edf0,z===0?125:170,17,.82,.55,2);light.position.set(x,4.55,z);light.target.position.set(x,0,z);
      this.box(.86,.12,.42,x,4.63,z,'steel',this.facility,.025);this.box(.7,.025,.3,x,4.54,z,'lamp');
      light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.2;light.shadow.camera.far=18;light.shadow.bias=-.00015;light.shadow.normalBias=.006;
      this.scene.add(light,light.target);this.localLights.push(light);
    }
    this.localShadowLights=Array.from({length:2},()=>{
      const light=new T.SpotLight(0xffffff,0,17,.82,.55,2);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.2;light.shadow.camera.far=18;light.shadow.bias=-.00015;light.shadow.normalBias=.006;light.shadow.autoUpdate=false;light.shadow.intensity=0;this.scene.add(light,light.target);return light;
    });
    for(const light of this.localLights)light.userData.baseIntensity=light.intensity;
    // Service pipes, collars, conduit and wall-mounted distribution boards.
    for(const [i,z] of [-MAP.halfDepth+.4,-MAP.halfDepth+.79,-MAP.halfDepth+1.06].entries()){
      const pipe=this.cylinder(i===0?.13:.067,i===0?.13:.067,MAP.width-1,0,3.45+i*.26,z,i===0?'paintedWall':'steel');pipe.rotation.z=Math.PI/2;
      for(let x=-MAP.halfWidth+2;x<=MAP.halfWidth-2;x+=2){const collar=this.cylinder(i===0?.155:.085,i===0?.155:.085,.055,x,3.45+i*.26,z,'edge');collar.rotation.z=Math.PI/2;}
    }
    for(let x=-MAP.halfWidth+2;x<MAP.halfWidth-1;x+=4){
      this.box(1.35,1.48,.13,x,.84,-MAP.halfDepth+.34,'steel',this.facility,.025);
      const panel=new T.Mesh(new T.PlaneGeometry(1.24,1.34),this.materials.panel);panel.position.set(x,.84,-MAP.halfDepth+.431);this.facility.add(panel);
      this.box(.055,1.2,.055,x+.6,2.3,-MAP.halfDepth+.36,'steel');
      this.box(.34,.21,.12,x,2.65,MAP.halfDepth-.3,'steel',this.facility,.02);this.box(.22,.085,.14,x,2.65,MAP.halfDepth-.36,'warm',this.facility,.015);
    }
    // Warning paint and floor grime are flat and do not introduce invisible obstacles.
    for(const z of [-6,0,6])for(let x=-14;x<2;x+=1.1)this.box(.6,.006,.035,x,.004,z,'yellow');
    for(let x=-MAP.halfWidth+4;x<=MAP.halfWidth-4;x+=4)this.box(.012,.003,MAP.depth-.6,x,-.018,0,'dark');
    for(let z=-MAP.halfDepth+4;z<=MAP.halfDepth-4;z+=4)this.box(MAP.width-.6,.003,.012,0,-.018,z,'dark');
    for(const x of [-36.7,36.7])for(const z of [-20,-12,0,12,20])this.box(.045,.008,.7,x,.006,z,x<0?'blue':'orange');
    for(const x of [-34,-22,-14,-6,2,10,22,34]){
      this.box(.24,.01,MAP.depth-.8,x,.008,0,'steel');for(let z=-MAP.halfDepth+.6;z<MAP.halfDepth-.5;z+=.24)this.box(.2,.012,.018,x,.013,z,'dark');
    }
    const grimeCanvas=document.createElement('canvas');grimeCanvas.width=grimeCanvas.height=128;const gc=grimeCanvas.getContext('2d'),g=gc.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(12,20,17,.36)');g.addColorStop(1,'rgba(12,20,17,0)');gc.fillStyle=g;gc.fillRect(0,0,128,128);
    const grime=new T.MeshBasicMaterial({map:new T.CanvasTexture(grimeCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    for(let i=0;i<28;i++){const mesh=new T.Mesh(new T.PlaneGeometry(.8+random()*2,.5+random()*1.5),grime);mesh.rotation.x=-Math.PI/2;mesh.rotation.z=random()*6;mesh.position.set(random()*(MAP.width-2)-MAP.halfWidth+1,.013,random()*(MAP.depth-2)-MAP.halfDepth+1);this.facility.add(mesh);}
    for(const b of BOXES.filter(b=>b.h<3.9)){const shadow=new T.Mesh(new T.PlaneGeometry(b.w+.7,b.d+.7),grime);shadow.rotation.x=-Math.PI/2;shadow.position.set(b.x,.017,b.z);this.facility.add(shadow);}
    this.sign('BLACKARMS','ZERO FACILITY / RESTRICTED AREA',6,-MAP.halfWidth+.23,2.8,0,Math.PI/2,'#9bbfc5');
    this.sign('SECTOR 06','DATA OPERATIONS / AUTHORIZED ACCESS',5,MAP.halfWidth-.23,2.8,0,-Math.PI/2,'#d8b38a');
    for(const [title,z] of [['02 / WEST',6],['03 / CENTRAL',0],['04 / EAST',-6]])this.sign(title,'OPERATIONS • KEEP CLEAR',2.4,-2.215,3.35,z,-Math.PI/2);
    this.sign('CORE CONTROL','06 / HIGH SECURITY',3.5,3.215,2.75,0,Math.PI/2,'#8fc6d0');this.sign('SERVICE / 07','MAINTENANCE ACCESS',3,6,2.7,5.585,0,'#d8b38a');
    for(const x of [-MAP.halfWidth+.35,MAP.halfWidth-.35])for(const z of [-6.8,6.8]){
      this.box(.13,1.85,1.05,x,1.1,z,'steel',this.facility,.02);this.box(.015,.62,.72,x+(x<0?.08:-.08),1.4,z,x<0?'blue':'orange',this.facility,.015);
      for(let i=0;i<5;i++)this.box(.025,.018,.48,x+(x<0?.095:-.095),.45+i*.065,z,'edge');
    }
    // Color-coded outer wings and door headers are above head height; collision remains shared.
    for(const z of [-10,10])for(const [x,w] of [[-12,1.4],[-6,1.4],[2.2,2.6],[8.3,1.4]]){
      this.box(w,.35,.48,x,3.82,z,'steel');this.box(w-.2,.05,.51,x,3.58,z,z<0?'blue':'orange');
    }
    for(const x of [-16,16])for(const z of [-5.25,5.25]){this.box(.5,.35,3.5,x,3.82,z,'steel');this.box(.52,.06,2.8,x,3.58,z,'lamp');}
    this.sign('NORTH / FREIGHT','09—11  /  TRANSFER & STORAGE',4.5,0,2.8,-17.77,0,'#94d6e3');
    this.sign('SOUTH / SERVICE','12—14  /  MAINTENANCE & ARCHIVES',4.5,0,2.8,17.77,Math.PI,'#e3b77d');
    for(const x of [-23,23])this.sign(x<0?'ALPHA / STAGING':'BRAVO / LOGISTICS','NORTH FREIGHT  ←  →  SOUTH SERVICE',4,x,3.1,x<0?-17.77:17.77,x<0?0:Math.PI);
    for(const b of BOXES.filter(b=>b.name.startsWith('档案机柜'))){
      for(let x=b.minX+.3;x<b.maxX;x+=.5)for(const side of [-1,1])this.box(.12,.07,.025,x,1.6,b.z+side*(b.d/2+.03),'blue');
    }
    for(const z of [-16.5,16.5])for(let x=-25;x<26;x+=1.3)this.box(.65,.006,.045,x,.008,z,z<0?'blue':'yellow');
    for(const [x,title,subtitle] of [[-16,'FREIGHT / 20','STORAGE  ←  →  POWER'],[0,'POWER / 21','PUMP STATION  ←  →  ENGINEERING'],[16,'TRANSFER / 22','LOADING  ←  →  SERVICE']])
      this.sign(title,subtitle,4,x,2.9,-MAP.halfDepth+.23,0,'#94d6e3');
    for(const [x,title,subtitle] of [[-16,'LABORATORY / 25','MEDICAL  ←  →  RESEARCH'],[0,'RESEARCH / 26','SAMPLES  ←  →  OFFICES'],[16,'OFFICES / 27','ADMINISTRATION  ←  →  COMMS']])
      this.sign(title,subtitle,4,x,2.9,MAP.halfDepth-.23,Math.PI,'#e3b77d');
    // Repeated doorway colors make the inner and outer circuits readable.
    for(const z of [-18,18])for(const x of [-20,-6,6,20]){
      this.box(4,.28,.46,x,3.86,z,'steel');this.box(3.7,.045,.49,x,3.69,z,z<0?'blue':'orange');
      this.box(3.6,.008,.12,x,.012,z,z<0?'blue':'yellow');
    }
    for(const x of [-28,28])for(const z of [-12,0,12]){
      this.box(.46,.28,4,x,3.86,z,'steel');this.box(.49,.045,3.7,x,3.69,z,'lamp');
    }
    for(const z of [-26.5,26.5])for(let x=-38;x<39;x+=1.3)this.box(.65,.006,.045,x,.008,z,z<0?'blue':'yellow');
    for(const x of [-38,38])for(let z=-25;z<26;z+=1.3)this.box(.045,.006,.65,x,.008,z,x<0?'blue':'orange');
    // Recessed core platform and floating data cartridge.
    this.box(2.95,.028,2.95,OBJECTIVE.x,.02,OBJECTIVE.z,'dark',this.facility,.04);
    for(const dx of [-1.35,1.35])for(const dz of [-1.35,1.35]){this.box(.42,.018,.045,6+dx,.043,dz,'yellow');this.box(.045,.018,.42,6+dx,.043,dz,'yellow');}
    this.ring=new T.Mesh(new T.RingGeometry(1.62,1.65,96),new T.MeshBasicMaterial({color:0x71c8d8,transparent:true,opacity:.45,side:T.DoubleSide}));this.ring.rotation.x=-Math.PI/2;this.ring.position.set(6,.051,0);this.scene.add(this.ring);
    this.coreGroup=new T.Group();this.scene.add(this.coreGroup);this.cylinder(.31,.36,.17,0,.17,0,'dark',this.coreGroup,8);
    this.coreMesh=new T.Group();this.coreMesh.position.y=.59;this.coreGroup.add(this.coreMesh);
    this.box(.24,.37,.24,0,0,0,'glass',this.coreMesh,.025);this.box(.095,.31,.095,0,0,0,'lamp',this.coreMesh,.012);
    for(const x of [-.19,.19]){this.box(.065,.48,.31,x,0,0,'edge',this.coreMesh,.018);for(const y of [-.2,.2])this.box(.38,.025,.3,0,y,0,'dark',this.coreMesh,.008);}
    this.coreOrbit=new T.Mesh(new T.TorusGeometry(.42,.008,6,72),this.materials.blue);this.coreOrbit.rotation.x=.5;this.coreGroup.add(this.coreOrbit);this.coreOrbit.position.y=.6;
    this.coreLight=new T.PointLight(0x75d2e8,2,4);this.coreLight.position.y=.6;this.coreGroup.add(this.coreLight);
  }
  batchFacility(){
    // Merge static surfaces by material so detail does not mean thousands of draw calls.
    this.facility.updateMatrixWorld(true);const groups=new Map(),old=[];
    // Pack facility signs into one atlas, so distinct labels share one draw call.
    const signs=[];this.facility.traverse(mesh=>{if(mesh.isMesh&&mesh.material.isMeshBasicMaterial&&!mesh.material.transparent&&mesh.material.map)signs.push(mesh);});
    const tiles=new Map();let signMaterial;
    if(signs.length){
      const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=128*Math.ceil(signs.length/4);
      const c=atlas.getContext('2d');
      signs.forEach((mesh,i)=>{const x=i%4*512,y=Math.floor(i/4)*128;c.drawImage(mesh.material.map.image,x,y,512,128);tiles.set(mesh,{x,y});});
      const map=new T.CanvasTexture(atlas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
      signMaterial=new T.MeshBasicMaterial({map});
    }
    this.facility.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.transparent)return;
      const tile=tiles.get(mesh),material=tile?signMaterial:mesh.material;
      let list=groups.get(material);if(!list){list=[];groups.set(material,list);}
      // RoundedBoxGeometry is non-indexed; normalize every primitive before merging.
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      if(tile){
        const uv=geometry.attributes.uv,{width,height}=signMaterial.map.image;
        for(let i=0;i<uv.count;i++)uv.setXY(i,(tile.x+.5+uv.getX(i)*511)/width,1-(tile.y+.5+(1-uv.getY(i))*127)/height);
      }
      geometry.applyMatrix4(mesh.matrixWorld);
      if(mesh.material===this.materials.concrete||mesh.material===this.materials.wall||['paintedWall','stagingFloor','containerRed','containerGreen','containerEdge','rack','hvac','caseShell','crane','conduit','ceiling'].some(name=>mesh.material===this.materials[name])){
        const positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;
        const scale=mesh.material===this.materials.concrete||mesh.material===this.materials.wall?.25:mesh.material===this.materials.stagingFloor?1/3:mesh.material===this.materials.paintedWall?.5:1;
        for(let i=0;i<positions.count;i++){
          const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
          uv.setXY(i,(Math.abs(normals.getX(i))>.5?z:x)*scale,(Math.abs(normals.getY(i))>.5?z:y)*scale);
        }
      }
      list.push(geometry);old.push(mesh);
    });
    for(const mesh of old){mesh.removeFromParent();if(tiles.has(mesh)){mesh.material.map.dispose();mesh.material.dispose();mesh.geometry.dispose();}}
    for(const [material,geometries] of groups){const merged=mergeGeometries(geometries,false);if(merged){const mesh=new T.Mesh(merged,material);mesh.castShadow=material!==this.materials.window&&material!==this.materials.lamp;mesh.receiveShadow=true;this.facility.add(mesh);}for(const g of geometries)g.dispose();}
  }
  createPostprocessing(){
    this.worldPass=pass(this.scene,this.camera,{samples:0});
    this.occlusion=ao(this.worldPass.getTextureNode('depth'),null,this.camera);this.occlusion.radius.value=.65;this.occlusion.resolutionScale=.5;
    this.atmosphere=atmospherePass(this,this.worldPass);
    this.weaponPass={enabled:false,node:transparentPass(this.gunScene,this.gunCamera,{samples:0})};
    this.weaponVisible=uniform(0);this.qualityEffects=uniform(1);this.gradeTime=uniform(0);
    const weapon=this.weaponPass.node.getTextureNode(),world=this.atmosphere.node;
    const shaded=vec4(world.rgb.mul(mix(1,this.occlusion.getTextureNode().r,this.qualityEffects)),1);
    const composed=vec4(mix(shaded.rgb,weapon.rgb,weapon.a.mul(this.weaponVisible)),1);
    this.bloom=bloom(composed,.1,.55,1.4);
    const color=composed.rgb.add(this.bloom.rgb.mul(this.qualityEffects));
    const vignette=float(1).sub(smoothstep(.16,.82,distance(uv(),vec2(.5))));
    const grain=fract(sin(dot(uv().add(fract(this.gradeTime).mul(.01)),vec2(12.9898,78.233))).mul(43758.5453));
    const graded=color.mul(mix(.83,1,vignette)).add(grain.sub(.5).mul(.006));
    // Depth effects need a single-sample world pass. SMAA works on linear color
    // before the output transform; FXAA operates on the final display color.
    this.smaa=smaa(vec4(graded,1));
    this.highQualityOutput=renderOutput(this.smaa,this.renderer.toneMapping,this.renderer.outputColorSpace);
    this.mediumQualityOutput=fxaa(renderOutput(vec4(graded,1),this.renderer.toneMapping,this.renderer.outputColorSpace));
    const simple=vec4(mix(this.worldPass.getTextureNode().rgb,weapon.rgb,weapon.a.mul(this.weaponVisible)),1);
    this.lowQualityOutput=fxaa(renderOutput(simple,this.renderer.toneMapping,this.renderer.outputColorSpace));
    this.composer=new T.PostProcessing(this.renderer,this.highQualityOutput);this.composer.outputColorTransform=false;
  }
  createDust(){
    const random=rng(812),positions=new Float32Array(150*3);for(let i=0;i<150;i++)positions.set([random()*(MAP.width-2)-MAP.halfWidth+1,random()*4.5+.3,random()*(MAP.depth-2)-MAP.halfDepth+1],i*3);
    const geometry=new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1,1));geometry.instanceCount=150;geometry.setAttribute('particlePosition',new T.InstancedBufferAttribute(positions,3));
    const material=new T.SpriteNodeMaterial({color:0xc1d2cf,transparent:true,opacity:.35,depthWrite:false});material.positionNode=attribute('particlePosition','vec3');material.scaleNode=float(.014);material.opacityNode=float(.35).mul(float(1).sub(smoothstep(.1,.5,uv().sub(.5).length())));
    this.dust=new T.Mesh(geometry,material);this.dust.frustumCulled=false;this.scene.add(this.dust);
  }
  async prepareGameplay(state,playerId){
    // Build the combat variants while the loading screen still covers the canvas.
    this.render(state,playerId,0,0,{prepareOnly:true});
    await this.renderer.compileAsync(this.scene,this.camera);
    for(const type of WEAPON_ORDER){
      await new Promise(resolve=>setTimeout(resolve,0));
      this.makeGun(type);this.gun.visible=true;this.muzzle.visible=true;
      await this.renderer.compileAsync(this.gunScene,this.gunCamera);
      this.muzzle.visible=false;
    }
    this.render(state,playerId,0,0,{prepareOnly:true});
    await this.composer.renderAsync();
    this.render({...state,config:{...state.config,mode:'elimination'}},playerId,0,0,{prepareOnly:true});
    await this.composer.renderAsync();
    // Render the menu too, so its postprocessing variants are ready before reveal.
    this.render(null,playerId,0,0,{prepareOnly:true});
    await this.composer.renderAsync();
    this.smoothPos=null;this.lastLook=null;this.lastRound='';
  }
  makeGun(type){
    this.gunCache??=new Map();
    if(this.weapon)this.gun.remove(this.weapon);
    this.shotTimer=0;this.weaponType=type;
    let cached=this.gunCache.get(type);
    if(!cached){
      const weapon=this.kit.weapon(type,this.gun,true),muzzle=createMuzzleFlash();
      muzzle.position.copy(weapon.userData.muzzle);weapon.add(muzzle);
      cached={weapon,muzzle};this.gunCache.set(type,cached);
    }
    this.weapon=cached.weapon;this.muzzle=cached.muzzle;
    this.muzzle.visible=false;this.gun.add(this.weapon);
  }
  resize(){
    const w=innerWidth,h=innerHeight,quality=this.settings.quality;
    const scale=renderPixelRatio(w,h,devicePixelRatio,quality);
    if(this.renderer.getPixelRatio()!==scale||this.renderWidth!==w||this.renderHeight!==h){
      this.renderer.setPixelRatio(scale);this.renderer.setSize(w,h,false);this.renderWidth=w;this.renderHeight=h;
    }
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.gunCamera.aspect=w/h;this.gunCamera.updateProjectionMatrix();
    const enabled=quality!=='low';
    this.sun.shadow.autoUpdate=enabled;this.sun.shadow.intensity=enabled?1:0;this.gunLight.shadow.autoUpdate=enabled;this.gunLight.shadow.intensity=enabled?1:0;this.wetFloor.visible=enabled;this.dust.visible=enabled;
    if(this.sunShadowUniforms)this.sunShadowUniforms.facilityShadowTaps.value=quality==='high'?16:10;
    this.wetFloor.userData.reflection.reflector.resolutionScale=(quality==='high'?768:512)/(h*scale);
    if(!this.composer)return;
    this.qualityEffects.value=enabled?1:0;this.atmosphere.enabled.value=enabled?1:0;
    const output=quality==='high'?this.highQualityOutput:enabled?this.mediumQualityOutput:this.lowQualityOutput;
    if(this.composer.outputNode!==output){this.composer.outputNode=output;this.composer.needsUpdate=true;}
    this.atmosphere.steps.value=quality==='high'?32:24;
    this.bloom.strength.value=quality==='high'?.15:.1;

  }
  event(e,playerId){
    // Events arrive at simulation frequency; consume short flashes only when a
    // frame is actually drawn, after old effects have advanced and round cleanup.
    if(e.type==='shot'){
      this.pendingShots??=[];this.pendingShots.push({e,playerId});
      if(this.pendingShots.length>64)this.pendingShots.shift();
      return;
    }
    this.applyEvent(e,playerId);
  }
  applyEvent(e,playerId){
    if(e.type==='shot'){
      if(e.actor===playerId){const kick=WEAPONS[e.weapon]?.kick??(e.weapon==='scatter'?.125:e.weapon==='pistol'?.052:.063);this.recoil=Math.min(.23,this.recoil+kick);this.shotTimer=this.flashDuration=e.weapon==='scatter'?.065:.045;this.muzzle.material.uniforms.seed.value=Math.random()*100;this.muzzle.rotation.z=Math.random()*Math.PI*2;this.muzzle.scale.setScalar(muzzleScale(e.weapon)*(.85+Math.random()*.3));}
      const model=this.models.get(e.actor);if(model)this.characters.fire(model);
      this.fx.shot(e,e.actor===playerId);
    }
    if(e.type==='damage'&&e.actor===playerId)this.shake=.045;
    if(e.type==='core'&&['uploading','completed','defused'].includes(e.state))this.fx.pulse(new T.Vector3(OBJECTIVE.x,.7,OBJECTIVE.z));
  }
  render(state,playerId,dt,time,view={}){
    this.recoil=Math.max(0,this.recoil-dt*.65);this.shake=Math.max(0,this.shake-dt*.2);this.shotTimer=Math.max(0,this.shotTimer-dt);this.fx.update(dt);
    this.wetFloor.material.uniforms.time.value=time;
    let follow=null,player=null;
    if(state){
      const round=`${state.round}:${state.config.mode}`;if(round!==this.lastRound){this.fx.clear();this.lastRound=round;}
      player=state.actors.find(a=>a.id===playerId);follow=state.actors.find(a=>a.id===(view.spectate||playerId))||player;
      const ids=new Set(state.actors.map(a=>a.id));for(const [id,model] of this.models)if(!ids.has(id)){this.characters.release(model);this.scene.remove(model);this.models.delete(id);}
      for(const a of state.actors){
        const side=a.squad===state.attackSquad?0:1;let model=this.models.get(a.id);
        if(!model){model=this.characters.create(side,a.name);this.models.set(a.id,model);this.scene.add(model);}
        if(model.userData.side!==side)this.characters.setSide(model,side);
        model.visible=a.id!==follow?.id;model.userData.marker.visible=a.alive&&a.squad===player?.squad;
        const target=new T.Vector3(a.x,a.y,a.z);if(!model.userData.started||model.position.distanceTo(target)>4){model.position.copy(target);model.userData.started=true;}else model.position.lerp(target,1-Math.exp(-dt*20));
        model.rotation.y=a.yaw;this.characters.animate(model,a,dt);
      }
      this.coreGroup.visible=state.config.mode==='core'&&!['completed','defused','none'].includes(state.core.state)&&!state.core.carrier;
      this.coreGroup.position.set(state.core.x,0,state.core.z);this.coreLight.intensity=['uploading','defusing'].includes(state.core.state)?3+Math.sin(time*5):1.5;this.ring.visible=state.config.mode==='core';
    }else{for(const model of this.models.values())model.visible=false;this.coreGroup.visible=true;this.coreGroup.position.set(6,0,0);this.ring.visible=true;}
    this.coreMesh.rotation.y=time*.6;this.coreMesh.position.y=.6+Math.sin(time*1.8)*.035;this.coreOrbit.rotation.z=time*.35;
    this.ring.material.opacity=.3+Math.sin(time*2)*.1;this.dust.rotation.y=Math.sin(time*.015)*.025;
    if(this.pendingShots?.length){
      // Equip first: makeGun resets the muzzle timer when changing weapons.
      if(follow&&this.weaponType!==follow.weapon)this.makeGun(follow.weapon);
      for(const {e,playerId:id} of this.pendingShots)this.applyEvent(e,id);
      this.pendingShots.length=0;this.fx.update(0);
    }
    if(follow){
      const desired=new T.Vector3(follow.x,(follow.crouch?1.07:1.57)+follow.y,follow.z);
      if(!this.smoothPos||this.smoothPos.distanceTo(desired)>4)this.smoothPos=desired;else this.smoothPos.lerp(desired,1-Math.exp(-dt*25));
      this.camera.position.copy(this.smoothPos);this.camera.position.x+=(Math.random()-.5)*this.shake;
      const pitch=view.pitch??follow.pitch,yaw=view.yaw??follow.yaw;
      this.camera.rotation.set(pitch+this.recoil*.17,yaw,0);
      const zoom=follow.aim&&!follow.reload&&!follow.switchTime?(WEAPONS[follow.weapon].zoom??1.25):1;
      this.camera.fov=T.MathUtils.lerp(this.camera.fov,settingsFov(this.settings.fov,zoom),1-Math.exp(-dt*12));this.camera.updateProjectionMatrix();
      const firstPersonSide=follow.squad===state.attackSquad?0:1;
      if(firstPersonSide!==this.firstPersonSide){const uniform=this.characters.sideMaterials[firstPersonSide].get('cloth'),sleeve=this.materials.sleeve;sleeve.color.copy(uniform.color);for(const key of ['map','normalMap','roughnessMap'])sleeve[key]=uniform[key];sleeve.needsUpdate=true;this.firstPersonSide=firstPersonSide;}
      if(this.weaponType!==follow.weapon)this.makeGun(follow.weapon);
      const model=this.models.get(follow.id),moving=Math.min(1,(model?.userData.speed||0)/2);this.moveBlend=T.MathUtils.damp(this.moveBlend,moving,8,dt);
      if(this.lastLook){this.sway.x=T.MathUtils.damp(this.sway.x,T.MathUtils.clamp(yaw-this.lastLook.yaw,-.1,.1),10,dt);this.sway.y=T.MathUtils.damp(this.sway.y,T.MathUtils.clamp(pitch-this.lastLook.pitch,-.1,.1),10,dt);}this.lastLook={yaw,pitch};
      const bob=(follow.sprinting?.02:.008)*this.moveBlend,aim=follow.aim;
      this.kit.animateWeapon(this.weapon,follow);
      const swapping=follow.switchTime>0;
      const target=new T.Vector3((aim?0:.24)-this.sway.x*.7,(swapping?-.65:follow.reload>0?-.4:aim?-.128:-.235)+Math.sin(time*(follow.sprinting?13:9))*bob-this.sway.y*.5,-.5+this.recoil*.6);
      this.gun.position.lerp(target,1-Math.exp(-dt*18));this.gun.rotation.set(this.recoil*.8+(follow.sprinting?-.12:0),follow.reload>0?-.55:0,swapping?-.35:follow.reload>0?-.6:-.025+Math.cos(time*8)*bob);
      if(aim)this.gun.rotation.z=T.MathUtils.damp(this.gun.rotation.z,0,25,dt);
      this.muzzle.visible=this.shotTimer>0&&!follow.reload&&!swapping;const flashFade=this.muzzle.visible?Math.pow(this.shotTimer/(this.flashDuration||.045),1.5):0;this.muzzle.material.uniforms.intensity.value=flashFade*5;this.flash.intensity=flashFade*9;this.gun.updateMatrixWorld(true);this.muzzle.getWorldPosition(this.flash.position);
    }else{
      this.smoothPos=null;this.lastLook=null;this.camera.fov=65;this.camera.updateProjectionMatrix();this.camera.position.set(10.2+Math.sin(time*.07)*.4,3.4,4.6);this.camera.lookAt(1.5,1.2,-3);
    }
    const scoped=follow?.aim&&WEAPONS[follow.weapon].zoom>1&&!follow.reload&&!follow.switchTime;
    const shadowCount=this.settings.quality==='high'?2:this.settings.quality==='medium'?1:0;
    const nearby=[...this.localLights].sort((a,b)=>a.position.distanceToSquared(this.camera.position)-b.position.distanceToSquared(this.camera.position));
    for(const light of this.localLights)light.intensity=light.userData.baseIntensity;
    this.localShadowLights.forEach((light,index)=>{
      const source=nearby[index],enabled=index<shadowCount;
      light.position.copy(source.position);light.target.position.copy(source.target.position);light.color.copy(source.color);
      light.intensity=enabled?source.intensity:0;light.shadow.intensity=enabled?1:0;light.shadow.autoUpdate=enabled;light.userData.active=enabled;
      if(enabled)source.intensity=0;
    });
    this.weaponPass.enabled=!!follow?.alive&&!scoped&&state?.phase!=='matchResult'&&state?.phase!=='roundResult';
    this.weaponVisible.value=this.weaponPass.enabled?1:0;this.gun.visible=this.weaponPass.enabled;this.gradeTime.value=time;
    this.atmosphere.uniforms.time.value=time;this.camera.updateMatrixWorld();this.atmosphere.update();
    if(!view.prepareOnly)this.composer.render();
  }
}
