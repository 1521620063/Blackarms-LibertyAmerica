import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BOXES, OBJECTIVE, rng } from './shared/data.js';
import { makeMaterials, labelTexture } from './visual/materials.js';
import { ModelKit } from './visual/models.js';
import { SoldierModels } from './visual/characters.js';
import { CombatEffects } from './visual/effects.js';
import { loadGeneratedArt } from './visual/generated-art.js';
import { facilityDecals } from './visual/decals.js';

export class WorldView {
  constructor(canvas,settings){
    this.settings=settings;this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    this.scene=new T.Scene();this.scene.background=new T.Color(0x18262b);this.scene.fog=new T.FogExp2(0x35454a,.013);
    this.camera=new T.PerspectiveCamera(settings.fov,1,.035,110);this.camera.rotation.order='YXZ';
    this.models=new Map();this.recoil=0;this.shake=0;this.shotTimer=0;this.weaponType='';this.smoothPos=null;this.lastRound='';this.sway=new T.Vector2();this.lastLook=null;this.moveBlend=0;
    const pmrem=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
    this.scene.environment=this.environment;this.scene.environmentIntensity=.55;
    this.scene.add(new T.HemisphereLight(0xbad9e5,0x6c6657,1.3));
    this.sun=new T.DirectionalLight(0xf5e6c6,3.6);this.sun.position.set(-9,16,8);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-20,right:20,top:16,bottom:-16,near:.5,far:45});this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.025;this.scene.add(this.sun);
    this.materials=makeMaterials();this.kit=new ModelKit(this.materials);this.facility=new T.Group();this.scene.add(this.facility);this.buildFacility();facilityDecals(this.facility);this.batchFacility();
    this.characters=new SoldierModels(this.kit);
    this.ready=Promise.all([this.characters.ready,loadGeneratedArt(this.materials,this.renderer)]).then(([,assets])=>{this.artAssets=assets;});
    this.gunScene=new T.Scene();this.gunScene.environment=this.environment;this.gunScene.environmentIntensity=1;
    this.gunScene.add(new T.HemisphereLight(0xc8e3eb,0x434737,1.9));const gunLight=new T.DirectionalLight(0xffe3ba,3);gunLight.position.set(-3,4,1);this.gunScene.add(gunLight);
    this.gunCamera=new T.PerspectiveCamera(65,1,.01,10);this.gun=new T.Group();this.gun.scale.setScalar(.82);this.gunScene.add(this.gun);
    this.flash=new T.PointLight(0xffbc75,0,4,2);this.gunScene.add(this.flash);
    this.fx=new CombatEffects(this.scene,settings);this.effects=this.fx.traces;
    this.createPostprocessing();this.createDust();this.resize();
  }
  box(w,h,d,x,y,z,material,parent=this.facility,r=0){return this.kit.box(parent,w,h,d,x,y,z,material,r);}
  cylinder(r,rt,h,x,y,z,material,parent=this.facility,segments=16){return this.kit.cylinder(parent,r,rt,h,x,y,z,material,segments);}
  sign(title,subtitle,w,x,y,z,rotation=0,color='#c4dcd9'){
    const texture=labelTexture(title,subtitle,color),mesh=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:texture}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;this.facility.add(mesh);return mesh;
  }
  buildFacility(){
    const random=rng(417);
    this.box(32,.22,20,0,-.13,0,'floor');
    // Keep all substantial geometry on the authoritative collision footprints.
    for(const [index,b] of BOXES.entries()){
      const wall=b.h>=3.9,thin=b.w<.6||b.d<.6;
      this.box(b.w,b.h,b.d,b.x,b.h/2,b.z,wall?'wall':b.h<1?'paintedWall':thin?'concrete':'steel',this.facility,wall?0:.035);
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
      }else if(!thin){
        // Armored cases / equipment cabinets, with recessed fronts and recessed handles.
        this.box(b.w+.025,.07,b.d+.025,b.x,b.h-.05,b.z,'edge',this.facility,.015);
        for(const side of [-1,1]){
          const face=new T.Mesh(new T.PlaneGeometry(b.w*.77,b.h*.67),this.materials.panel);
          face.position.set(b.x,b.h*.5,b.z+side*(b.d/2+.025));face.rotation.y=side<0?Math.PI:0;this.facility.add(face);
          for(const x of [-1,1]){
            this.box(.07,b.h*.85,b.d+.035,b.x+x*(b.w/2-.07),b.h*.5,b.z,'edge',this.facility,.007);
            this.box(.11,.09,.045,b.x+x*b.w*.27,b.h*.73,b.z+side*(b.d/2+.026),'steel',this.facility,.012);
          }
          for(let i=0;i<5;i++)this.box(b.w*.51,.025,.025,b.x,b.h*.33+i*.065,b.z+side*(b.d/2+.025),'steel');
          this.box(.15,.045,.027,b.x,b.h*.75,b.z+side*(b.d/2+.025),index%2?'orange':'blue');
        }
      }else{
        this.box(b.w+.03,.065,b.d+.03,b.x,b.h-.04,b.z,'edge');
        for(let y=.5;y<b.h;y+=.8)this.box(b.w+.014,.012,b.d+.014,b.x,y,b.z,'dark');
      }
    }
    // Structural ceiling: steel I-beams, skylight coffers and cable trays.
    for(let x=-14;x<=14;x+=4){
      this.box(.12,.42,20,x,5.12,0,'steel');this.box(.32,.065,20,x,4.94,0,'dark');
      for(const z of [-7.5,-2.5,2.5,7.5]){
        this.box(3.7,.08,4.7,x+1.9,5.55,z,'dark');
        if(Math.abs(z)===2.5){this.box(2.9,.045,1.45,x+1.9,5.48,z,'lamp');for(let i=0;i<5;i++)this.box(.035,.07,1.48,x+.7+i*.6,5.43,z,'steel');}
      }
      for(const z of [-8,0,8]){
        this.box(1.8,.14,.36,x,4.77,z,'steel',this.facility,.025);this.box(1.57,.025,.23,x,4.69,z,'lamp');
        for(const dx of [-.65,.65])this.cylinder(.009,.009,.32,x+dx,5,z,'edge',this.facility,6);
      }
    }
    for(const x of [-12,-4,5,13]){const light=new T.PointLight(x===5?0xa4d6ee:0xd8e9eb,18,13,2);light.position.set(x,4.25,0);this.scene.add(light);}
    // Service pipes, collars, conduit and wall-mounted distribution boards.
    for(const [i,z] of [-9.6,-9.21,-8.94].entries()){
      const pipe=this.cylinder(i===0?.13:.067,i===0?.13:.067,31,0,3.45+i*.26,z,i===0?'paintedWall':'steel');pipe.rotation.z=Math.PI/2;
      for(let x=-14;x<=14;x+=2){const collar=this.cylinder(i===0?.155:.085,i===0?.155:.085,.055,x,3.45+i*.26,z,'edge');collar.rotation.z=Math.PI/2;}
    }
    for(let x=-14;x<15;x+=3.5){
      this.box(1.35,1.48,.13,x,.84,-9.66,'steel',this.facility,.025);
      const panel=new T.Mesh(new T.PlaneGeometry(1.24,1.34),this.materials.panel);panel.position.set(x,.84,-9.569);this.facility.add(panel);
      this.sign('HV / '+String(Math.round(x+15)).padStart(2,'0'),'POWER DISTRIBUTION',.75,x,1.85,-9.68,0,'#bcba9a');
      this.box(.055,1.2,.055,x+.6,2.3,-9.64,'steel');
      this.box(.34,.21,.12,x,2.65,9.7,'steel',this.facility,.02);this.box(.22,.085,.14,x,2.65,9.64,'warm',this.facility,.015);
    }
    // Warning paint and floor grime are flat and do not introduce invisible obstacles.
    for(const z of [-6,0,6])for(let x=-14;x<2;x+=1.1)this.box(.6,.006,.035,x,.004,z,'yellow');
    for(const x of [-12,-8,-4,0,4,8,12])this.box(.012,.003,19.4,x,-.018,0,'dark');
    for(const z of [-8,-4,0,4,8])this.box(31.4,.003,.012,0,-.018,z,'dark');
    for(const x of [-13.7,13.7])for(const z of [-7,-4,0,4,7])this.box(.045,.008,.7,x,.006,z,x<0?'blue':'orange');
    for(const x of [-14,-6,2,10]){
      this.box(.24,.01,19.2,x,.008,0,'steel');for(let z=-9.4;z<9.5;z+=.24)this.box(.2,.012,.018,x,.013,z,'dark');
    }
    const grimeCanvas=document.createElement('canvas');grimeCanvas.width=grimeCanvas.height=128;const gc=grimeCanvas.getContext('2d'),g=gc.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(12,20,17,.36)');g.addColorStop(1,'rgba(12,20,17,0)');gc.fillStyle=g;gc.fillRect(0,0,128,128);
    const grime=new T.MeshBasicMaterial({map:new T.CanvasTexture(grimeCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    for(let i=0;i<28;i++){const mesh=new T.Mesh(new T.PlaneGeometry(.8+random()*2,.5+random()*1.5),grime);mesh.rotation.x=-Math.PI/2;mesh.rotation.z=random()*6;mesh.position.set(random()*30-15,.013,random()*18-9);this.facility.add(mesh);}
    for(const b of BOXES.filter(b=>b.h<3.9)){const shadow=new T.Mesh(new T.PlaneGeometry(b.w+.7,b.d+.7),grime);shadow.rotation.x=-Math.PI/2;shadow.position.set(b.x,.017,b.z);this.facility.add(shadow);}
    this.sign('BLACKARMS','ZERO FACILITY / RESTRICTED AREA',6,-15.77,2.8,0,Math.PI/2,'#9bbfc5');
    this.sign('SECTOR 06','DATA OPERATIONS / AUTHORIZED ACCESS',5,15.77,2.8,0,-Math.PI/2,'#d8b38a');
    for(const [title,z] of [['02 / WEST',6],['03 / CENTRAL',0],['04 / EAST',-6]])this.sign(title,'OPERATIONS • KEEP CLEAR',2.4,-2.215,3.35,z,-Math.PI/2);
    this.sign('CORE CONTROL','06 / HIGH SECURITY',3.5,3.215,2.75,0,Math.PI/2,'#8fc6d0');this.sign('SERVICE / 07','MAINTENANCE ACCESS',3,6,2.7,5.585,0,'#d8b38a');
    for(const x of [-15.65,15.65])for(const z of [-6.8,6.8]){
      this.box(.13,1.85,1.05,x,1.1,z,'steel',this.facility,.02);this.box(.015,.62,.72,x+(x<0?.08:-.08),1.4,z,x<0?'blue':'orange',this.facility,.015);
      for(let i=0;i<5;i++)this.box(.025,.018,.48,x+(x<0?.095:-.095),.45+i*.065,z,'edge');
    }
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
    this.facility.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.transparent)return;
      let list=groups.get(mesh.material);if(!list){list=[];groups.set(mesh.material,list);}
      // RoundedBoxGeometry is non-indexed; normalize every primitive before merging.
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      if(mesh.material===this.materials.concrete||mesh.material===this.materials.wall){
        const positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;
        for(let i=0;i<positions.count;i++){
          const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
          uv.setXY(i,(Math.abs(normals.getX(i))>.5?z:x)*.5,(Math.abs(normals.getY(i))>.5?z:y)*.5);
        }
      }
      list.push(geometry);old.push(mesh);
    });
    for(const mesh of old)mesh.removeFromParent();
    for(const [material,geometries] of groups){const merged=mergeGeometries(geometries,false);if(merged){const mesh=new T.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;this.facility.add(mesh);}for(const g of geometries)g.dispose();}
  }
  createPostprocessing(){
    this.composer=new EffectComposer(this.renderer);this.worldPass=new RenderPass(this.scene,this.camera);this.composer.addPass(this.worldPass);
    this.weaponPass=new RenderPass(this.gunScene,this.gunCamera);this.weaponPass.clear=false;this.weaponPass.clearDepth=true;this.composer.addPass(this.weaponPass);
    this.bloom=new UnrealBloomPass(new T.Vector2(1,1),.24,.55,1.4);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float time;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float vignette=1.0-smoothstep(.16,.82,distance(vUv,vec2(.5)));c*=mix(.83,1.0,vignette);float grain=fract(sin(dot(vUv+fract(time)*.01,vec2(12.9898,78.233)))*43758.5453);c+=(grain-.5)*.006;gl_FragColor=vec4(c,1.0);}'});this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());
  }
  createDust(){
    const random=rng(812),positions=new Float32Array(150*3);for(let i=0;i<150;i++)positions.set([random()*30-15,random()*4.5+.3,random()*18-9],i*3);
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));this.dust=new T.Points(geometry,new T.PointsMaterial({color:0xc1d2cf,size:.014,transparent:true,opacity:.35,depthWrite:false}));this.scene.add(this.dust);
  }
  makeGun(type){
    if(this.weapon){this.gun.remove(this.weapon);this.muzzle.material.map.dispose();this.muzzle.material.dispose();}
    this.weaponType=type;this.weapon=this.kit.weapon(type,this.gun,true);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,240,1)');g.addColorStop(.15,'rgba(255,228,157,.95)');g.addColorStop(.4,'rgba(255,131,35,.6)');g.addColorStop(1,'rgba(255,100,20,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
    c.strokeStyle='rgba(255,224,161,.7)';c.lineWidth=4;for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(64,64);c.lineTo(64+Math.cos(a)*50,64+Math.sin(a)*50);c.stroke();}
    this.muzzle=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),color:0xffdcb0,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));this.muzzle.position.copy(this.weapon.userData.muzzle);this.muzzle.scale.set(.36,.36,1);this.weapon.add(this.muzzle);this.muzzle.visible=false;
  }
  resize(){
    const w=innerWidth,h=innerHeight,quality=this.settings.quality;
    const scale=quality==='low'?.8:quality==='high'?Math.min(devicePixelRatio,1.75):Math.min(devicePixelRatio,1.25);
    this.renderer.setPixelRatio(scale);this.renderer.setSize(w,h,false);this.composer.setPixelRatio(scale);this.composer.setSize(w,h);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.gunCamera.aspect=w/h;this.gunCamera.updateProjectionMatrix();
    this.renderer.shadowMap.enabled=quality!=='low';this.bloom.enabled=quality!=='low';this.bloom.strength=quality==='high'?.32:.22;this.grade.enabled=quality!=='low';this.dust.visible=quality!=='low';
    this.fx.spark.material.uniforms.scale.value=h*scale;this.fx.smoke.material.uniforms.scale.value=h*scale;
  }
  event(e,playerId){
    if(e.type==='shot'){
      if(e.actor===playerId){const kick=e.weapon==='scatter'?.125:e.weapon==='pistol'?.052:.063;this.recoil=Math.min(.23,this.recoil+kick);this.shotTimer=e.weapon==='scatter'?.065:.04;}
      this.fx.shot(e,e.actor===playerId);
    }
    if(e.type==='damage'&&e.actor===playerId)this.shake=.045;
    if(e.type==='core'&&['uploading','completed','defused'].includes(e.state))this.fx.pulse(new T.Vector3(OBJECTIVE.x,.7,OBJECTIVE.z));
  }
  render(state,playerId,dt,time,view={}){
    this.recoil=Math.max(0,this.recoil-dt*.65);this.shake=Math.max(0,this.shake-dt*.2);this.shotTimer=Math.max(0,this.shotTimer-dt);this.fx.update(dt);
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
    if(follow){
      const desired=new T.Vector3(follow.x,(follow.crouch?1.07:1.57)+follow.y,follow.z);
      if(!this.smoothPos||this.smoothPos.distanceTo(desired)>4)this.smoothPos=desired;else this.smoothPos.lerp(desired,1-Math.exp(-dt*25));
      this.camera.position.copy(this.smoothPos);this.camera.position.x+=(Math.random()-.5)*this.shake;
      const pitch=view.pitch??follow.pitch,yaw=view.yaw??follow.yaw;
      this.camera.rotation.set(pitch+this.recoil*.17,yaw,0);
      this.camera.fov=T.MathUtils.lerp(this.camera.fov,this.settings.fov*(follow.aim?.8:1),1-Math.exp(-dt*12));this.camera.updateProjectionMatrix();
      if(this.weaponType!==follow.weapon)this.makeGun(follow.weapon);
      const model=this.models.get(follow.id),moving=Math.min(1,(model?.userData.speed||0)/2);this.moveBlend=T.MathUtils.damp(this.moveBlend,moving,8,dt);
      if(this.lastLook){this.sway.x=T.MathUtils.damp(this.sway.x,T.MathUtils.clamp(yaw-this.lastLook.yaw,-.1,.1),10,dt);this.sway.y=T.MathUtils.damp(this.sway.y,T.MathUtils.clamp(pitch-this.lastLook.pitch,-.1,.1),10,dt);}this.lastLook={yaw,pitch};
      const bob=(follow.sprinting?.02:.008)*this.moveBlend,aim=follow.aim;
      const target=new T.Vector3((aim?0:.24)-this.sway.x*.7,(follow.reload>0?-.4:aim?-.128:-.235)+Math.sin(time*(follow.sprinting?13:9))*bob-this.sway.y*.5,-.5+this.recoil*.6);
      this.gun.position.lerp(target,1-Math.exp(-dt*18));this.gun.rotation.set(this.recoil*.8+(follow.sprinting?-.12:0),follow.reload>0?-.55:0,follow.reload>0?-.6:-.025+Math.cos(time*8)*bob);
      if(aim)this.gun.rotation.z=T.MathUtils.damp(this.gun.rotation.z,0,25,dt);
      this.muzzle.visible=this.shotTimer>0;this.muzzle.material.rotation=time*31;this.muzzle.scale.setScalar((this.weaponType==='scatter'?.34:.18)+Math.random()*.1);this.flash.intensity=this.muzzle.visible?7:0;this.gun.updateMatrixWorld(true);this.muzzle.getWorldPosition(this.flash.position);
    }else{
      this.smoothPos=null;this.lastLook=null;this.camera.fov=65;this.camera.updateProjectionMatrix();this.camera.position.set(10.2+Math.sin(time*.07)*.4,3.4,4.6);this.camera.lookAt(1.5,1.2,-3);
    }
    this.weaponPass.enabled=!!follow?.alive&&state?.phase!=='matchResult'&&state?.phase!=='roundResult';this.grade.uniforms.time.value=time;this.composer.render(dt);this.renderer.autoClear=true;
  }
}
