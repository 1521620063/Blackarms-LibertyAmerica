import * as T from 'three';
import { BOXES, OBJECTIVE, WEAPONS } from './shared/data.js';

const TEAM=[0x69d4ef,0xf7a566];
export class WorldView {
  constructor(canvas,settings) {
    this.settings=settings;this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x10171c);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
    this.scene=new T.Scene();this.scene.background=new T.Color(0x18232b);this.scene.fog=new T.FogExp2(0x18232b,.022);
    this.camera=new T.PerspectiveCamera(settings.fov,1,.045,110);this.camera.rotation.order='YXZ';
    this.models=new Map();this.effects=[];this.recoil=0;this.shake=0;this.weaponType='';this.smoothPos=null;
    this.scene.add(new T.HemisphereLight(0xc8e4ef,0x6b6654,2.2));
    const sun=new T.DirectionalLight(0xe8f0e3,3.2);sun.position.set(-7,14,6);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-19,right:19,top:14,bottom:-14,near:.5,far:40});sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;
    this.scene.add(sun);this.sun=sun;
    this.materials=this.makeMaterials();this.buildFacility();
    this.gunScene=new T.Scene();this.gunScene.add(new T.HemisphereLight(0xe4eff2,0x434b4a,3));
    const gunLight=new T.DirectionalLight(0xffffff,4);gunLight.position.set(-2,4,2);this.gunScene.add(gunLight);
    this.gunCamera=new T.PerspectiveCamera(65,1,.01,10);this.gun=new T.Group();this.gun.scale.setScalar(.7);this.gunScene.add(this.gun);
    this.flash=new T.PointLight(0x82dcff,0,3);this.gunScene.add(this.flash);
    this.resize();
  }
  texture(kind) {
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
    const im=ctx.createImageData(256,256);
    for(let i=0;i<im.data.length;i+=4) {const n=Math.random()*22;const base=kind==='floor'?83:145;im.data[i]=base+n;im.data[i+1]=base+n;im.data[i+2]=base+n;im.data[i+3]=255;}
    ctx.putImageData(im,0,0);
    if(kind==='floor') {
      ctx.strokeStyle='#343d3e';ctx.lineWidth=3;ctx.strokeRect(1,1,254,254);
      ctx.strokeStyle='rgba(220,225,216,.16)';ctx.lineWidth=2;
      for(let y=12;y<256;y+=13)for(let x=9;x<256;x+=24){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+7,y-5);ctx.stroke();}
      ctx.fillStyle='#343b3d';for(const x of [8,248])for(const y of [8,248]){ctx.beginPath();ctx.arc(x,y,2.5,0,7);ctx.fill();}
    } else {ctx.strokeStyle='rgba(45,49,47,.15)';ctx.lineWidth=1;ctx.strokeRect(1,1,254,254);for(let i=0;i<25;i++){ctx.beginPath();ctx.moveTo(Math.random()*256,Math.random()*256);ctx.lineTo(Math.random()*256,Math.random()*256);ctx.stroke();}}
    const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;tex.repeat.set(kind==='floor'?16:1,kind==='floor'?10:1);return tex;
  }
  makeMaterials() {
    const m=(color,roughness=.8,metalness=.1,extra={})=>new T.MeshStandardMaterial({color,roughness,metalness,...extra});
    return {concrete:m(0x777c75,.96,0,{map:this.texture('concrete')}),wall:m(0x92968a,.94,0,{map:this.texture('concrete')}),
      floor:m(0xa0aaa2,.72,.35,{map:this.texture('floor')}),steel:m(0x283438,.5,.65),dark:m(0x161e21,.6,.35),
      olive:m(0x4d5643,.95,0),sand:m(0x8d8060,.95,0),edge:m(0x83928d,.5,.7),yellow:m(0xd2ad53,.8,.2),
      blue:m(0x3d99ae,.4,.4,{emissive:0x2584a4,emissiveIntensity:.45}),orange:m(0xe3a36c,.5,.3,{emissive:0xcc5520,emissiveIntensity:.3}),
      lamp:m(0xd9ede7,.4,0,{emissive:0xd2eee9,emissiveIntensity:2}),red:m(0xba4c35,.5,.4,{emissive:0x962b19,emissiveIntensity:.8})};
  }
  box(w,h,d,x,y,z,mat,parent=this.scene) {
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),typeof mat==='string'?this.materials[mat]:mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  cylinder(r,rt,h,x,y,z,mat,parent=this.scene,segments=10) {
    const mesh=new T.Mesh(new T.CylinderGeometry(r,rt,h,segments),typeof mat==='string'?this.materials[mat]:mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  sign(text,sub,w,x,y,z,rotation=0,color='#ccd9d5') {
    const c=document.createElement('canvas');c.width=768;c.height=192;const ctx=c.getContext('2d');
    ctx.fillStyle='#172329';ctx.fillRect(0,0,768,192);ctx.fillStyle=color;ctx.fillRect(0,0,12,192);
    ctx.font='bold 70px Arial';ctx.fillText(text,35,91);ctx.font='24px Arial';ctx.fillStyle='#8faaa9';ctx.fillText(sub,38,147);
    const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:tx}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;this.scene.add(mesh);
  }
  buildFacility() {
    this.box(32,.2,20,0,-.12,0,'floor');
    for(const [i,b] of BOXES.entries()) {
      const wall=b.h>=3.9;this.box(b.w,b.h,b.d,b.x,b.h/2,b.z,wall?'wall':b.h<1?'olive':'concrete');
      if(wall) {
        this.box(b.w+.025,.16,b.d+.025,b.x,.2,b.z,'dark');
        this.box(b.w+.03,.12,b.d+.03,b.x,3.1,b.z,i%3===0?'orange':'steel');
      } else {
        this.box(b.w+.055,.06,b.d+.055,b.x,b.h+.02,b.z,'edge');
        if(b.w>.8) for(let j=0;j<Math.floor(b.w/.3);j++) {const stripe=this.box(.13,.12,b.d+.06,b.x-b.w/2+.16+j*.3,b.h-.12,b.z,'yellow');stripe.rotation.z=-.25;}
      }
    }
    // Roof bays, exposed trusses and a row of luminous skylights.
    for(let x=-14;x<=14;x+=4) {
      this.box(.18,.32,20,x,5.1,0,'steel');
      for(const z of [-7.5,-2.5,2.5,7.5]) {
        this.box(3.7,.09,4.7,x+1.9,5.55,z,'dark');
        if(z===-2.5||z===2.5)this.box(2.8,.04,1.5,x+1.9,5.48,z,'lamp');
      }
      for(const z of [-8,0,8]) {
        this.box(1.9,.11,.3,x,4.9,z,'steel');this.box(1.65,.035,.2,x,4.83,z,'lamp');
      }
    }
    // Cold white practical lighting and warm emergency lamps.
    for(const x of [-12,-4,5,13]) {
      const light=new T.PointLight(x===5?0xa5d9ed:0xd8e5d9,12,14,1.7);light.position.set(x,4.6,0);this.scene.add(light);
      for(const z of [-9.7,9.7]) {this.box(.34,.28,.12,x,2.5,z,'red');}
    }
    for(const z of [-9.4,-9.05]) {
      const pipe=this.cylinder(.12,.12,31,0,3.7,z,'steel',this.scene,12);pipe.rotation.z=Math.PI/2;
      for(let x=-14;x<=14;x+=4)this.box(.1,.5,.65,x,3.72,z,'dark');
    }
    // Floor route markings.
    for(const z of [-6,0,6]) {
      for(let x=-14;x<2;x+=1)this.box(.55,.012,.035,x,.007,z,'yellow');
    }
    for(const x of [-13.7,13.7])for(const z of [-7,-4,0,4,7])this.box(.04,.015,.7,x,.012,z,x<0?'blue':'orange');
    this.sign('BLACKARMS','ZERO FACILITY / SECTOR 00',6,-15.75,2.8,0,Math.PI/2,'#86d8e5');
    this.sign('DEFENSE','AUTHORIZED PERSONNEL ONLY',5,15.75,2.8,0,-Math.PI/2,'#efb077');
    for(const [text,z] of [['LEFT / 02',6],['MID / 03',0],['RIGHT / 04',-6]]) this.sign(text,'TACTICAL ACCESS',2.5,-2.24,3.55,z,-Math.PI/2);
    this.sign('CORE / 06','DATA CONTROL / KEEP CLEAR',3.8,3.24,2.7,0,Math.PI/2,'#86d8e5');
    this.sign('FLANK / 07','MAINTENANCE CORRIDOR',3,6,2.6,5.57,0,'#d9b46c');
    // Racks and consoles are shallow decorations inside the boundary collision.
    for(let x=-13;x<=13;x+=3) {
      this.box(1.8,1.3,.15,x,.68,-9.65,'steel');
      for(let i=0;i<5;i++)this.box(1.4,.025,.025,x,.25+i*.2,-9.55,'edge');
      this.box(.45,.18,.03,x,1.12,-9.55,x<0?'blue':'orange');
    }
    for(const z of [-6.8,6.8]) {
      this.box(.18,2,1.1,-15.62,1,z,'olive');this.box(.035,.6,.65,-15.5,1.3,z,'blue');
      this.box(.18,2,1.1,15.62,1,z,'sand');this.box(.035,.6,.65,15.5,1.3,z,'orange');
    }
    this.box(2.9,.025,2.9,OBJECTIVE.x,.018,OBJECTIVE.z,'steel');
    const ring=new T.Mesh(new T.RingGeometry(1.7,1.77,64),new T.MeshBasicMaterial({color:0x77d1dd,side:T.DoubleSide,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2;ring.position.set(6,.04,0);this.scene.add(ring);this.ring=ring;
    this.coreGroup=new T.Group();this.scene.add(this.coreGroup);
    this.cylinder(.27,.35,.25,0,.2,0,'dark',this.coreGroup,6);
    this.coreMesh=this.box(.28,.4,.28,0,.6,0,'blue',this.coreGroup);this.coreMesh.rotation.z=.22;
    for(const x of [-.24,.24])this.box(.07,.58,.35,x,.55,0,'edge',this.coreGroup);
    this.coreLight=new T.PointLight(0x6ed6e8,3,4);this.coreLight.position.y=.6;this.coreGroup.add(this.coreLight);
  }
  soldier(side,name='') {
    const squad=side;
    const root=new T.Group(),legs=new T.Group();root.add(legs);
    const cloth=squad===0?'olive':'sand',accent=squad===0?'blue':'orange';
    for(const x of [-.15,.15]) {
      this.box(.22,.62,.24,x,.48,0,cloth,legs);this.box(.25,.15,.37,x,.1,-.05,'dark',legs);
      this.box(.25,.2,.1,x,.53,-.15,'steel',legs);
    }
    const torso=new T.Group();root.add(torso);
    this.box(.66,.6,.36,0,1.15,0,cloth,torso);this.box(.59,.5,.16,0,1.2,-.23,'steel',torso);
    for(const x of [-.2,0,.2])this.box(.15,.2,.12,x,1.05,-.36,'olive',torso);
    this.box(.45,.08,.04,0,1.43,-.325,accent,torso);
    this.box(.38,.37,.34,0,1.7,0,'dark',torso);this.box(.47,.17,.4,0,1.87,0,cloth,torso);
    this.box(.34,.075,.03,0,1.73,-.19,accent,torso);
    for(const x of [-.44,.44]) {
      this.box(.21,.44,.25,x,1.24,0,cloth,torso);
      this.box(.23,.12,.26,x,1.38,0,accent,torso);
      const arm=this.box(.18,.4,.2,x,1.16,-.3,cloth,torso);arm.rotation.x=-1.1;
    }
    this.box(.12,.13,.85,.18,1.25,-.58,'dark',torso);this.box(.09,.07,.3,.18,1.34,-.88,'steel',torso);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#e0edc1';ctx.textAlign='center';ctx.font='bold 21px Arial';ctx.fillText('▽ '+name,128,35);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const marker=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:true}));marker.position.y=2.3;marker.scale.set(1.6,.4,1);root.add(marker);
    root.userData={legs,torso,marker,side};this.scene.add(root);return root;
  }
  makeGun(type) {
    this.gun.traverse(o=>{o.geometry?.dispose();if(o===this.muzzle)o.material.dispose();});
    this.gun.clear();this.weaponType=type;
    const pistol=type==='pistol',scatter=type==='scatter';
    const dark=this.materials.dark,steel=this.materials.steel;
    this.box(.13,.16,pistol?.34:.57,0,0,0,steel,this.gun);
    this.box(.1,.075,pistol?.17:.4,0,.07,-.2,dark,this.gun);
    this.box(.09,.21,.13,0,-.16,.12,'olive',this.gun).rotation.x=-.3;
    this.box(.055,.02,pistol?.33:.48,0,.095,-.02,'edge',this.gun);
    if(!pistol) {
      this.box(.13,.16,.23,0,-.16,-.04,scatter?'sand':'olive',this.gun).rotation.x=.1;
      this.box(.1,.16,.3,0,-.01,.35,'dark',this.gun);
      for(let i=0;i<6;i++)this.box(.145,.015,.035,0,.096,-.2+i*.045,'dark',this.gun);
      this.box(.07,.07,.11,0,.16,.1,'dark',this.gun);this.box(.04,.028,.012,0,.16,.16,'blue',this.gun);
    }
    this.box(.15,.13,.06,0,0,pistol?-.25:-.48,'dark',this.gun);
    this.box(.11,.024,.24,.071,.015,-.05,scatter?'orange':'blue',this.gun);
    // Forearms and gloves.
    const arm=this.box(.15,.14,.48,.11,-.23,.38,'olive',this.gun);arm.rotation.y=-.18;
    this.box(.14,.14,.16,0,-.15,.14,'dark',this.gun);
    if(!pistol) {const left=this.box(.15,.13,.43,-.2,-.22,-.02,'olive',this.gun);left.rotation.z=-.35;left.rotation.y=-.35;this.box(.15,.1,.13,-.08,-.11,-.23,'dark',this.gun);}
    const flashMat=new T.MeshBasicMaterial({color:0xb2edff,transparent:true,opacity:.9,side:T.DoubleSide});
    this.muzzle=new T.Mesh(new T.ConeGeometry(.11,.28,5),flashMat);this.muzzle.rotation.x=-Math.PI/2;this.muzzle.position.set(0,0,pistol?-.4:-.63);this.muzzle.visible=false;this.gun.add(this.muzzle);
  }
  resize() {
    const w=innerWidth,h=innerHeight;
    const scale=this.settings.quality==='low'?.75:this.settings.quality==='high'?Math.min(devicePixelRatio,1.7):Math.min(devicePixelRatio,1.2);
    this.renderer.setPixelRatio(scale);this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.gunCamera.aspect=w/h;this.gunCamera.updateProjectionMatrix();
    this.renderer.shadowMap.enabled=this.settings.quality!=='low';
  }
  event(e,playerId) {
    if(e.type==='shot') {
      if(e.actor===playerId) this.recoil=Math.min(.18,this.recoil+.065);
      for(const trace of e.traces) {
        const pts=[new T.Vector3(e.origin.x,e.origin.y,e.origin.z),new T.Vector3(trace.end.x,trace.end.y,trace.end.z)];
        const mat=new T.LineBasicMaterial({color:e.weapon==='scatter'?0xf4b876:0x9ee5f6,transparent:true,opacity:.75});
        const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),mat);this.scene.add(line);this.effects.push({mesh:line,life:.07,max:.07});
        const spark=new T.Mesh(new T.IcosahedronGeometry(.045,0),new T.MeshBasicMaterial({color:trace.hit?0xf3bc71:0xbee4d9,transparent:true}));spark.position.copy(pts[1]);this.scene.add(spark);this.effects.push({mesh:spark,life:.16,max:.16});
      }
    }
    if(e.type==='damage'&&e.actor===playerId) this.shake=.045;
  }
  render(state,playerId,dt,time,view={}) {
    this.recoil=Math.max(0,this.recoil-dt*.65);this.shake=Math.max(0,this.shake-dt*.2);
    for(let i=this.effects.length-1;i>=0;i--) {
      const fx=this.effects[i];fx.life-=dt;fx.mesh.material.opacity=Math.max(0,fx.life/fx.max);
      if(fx.life<=0){this.scene.remove(fx.mesh);fx.mesh.geometry.dispose();fx.mesh.material.dispose();this.effects.splice(i,1);}
    }
    let follow=null,player=null;
    if(state) {
      player=state.actors.find(a=>a.id===playerId);
      follow=state.actors.find(a=>a.id===(view.spectate||playerId))||player;
      const ids=new Set(state.actors.map(a=>a.id));
      for(const [id,model] of this.models)if(!ids.has(id)){this.scene.remove(model);this.models.delete(id);}
      for(const a of state.actors) {
        const side=a.squad===state.attackSquad?0:1;
        let model=this.models.get(a.id);if(!model){model=this.soldier(side,a.name);this.models.set(a.id,model);}
        if(model.userData.side!==side){
          const old=model.userData.side;
          model.traverse(o=>{if(o.material===this.materials[old===0?'blue':'orange'])o.material=this.materials[side===0?'blue':'orange'];else if(o.material===this.materials[old===0?'olive':'sand'])o.material=this.materials[side===0?'olive':'sand'];});
          model.userData.side=side;
        }
        model.visible=a.id!==follow?.id;model.userData.marker.visible=a.alive&&a.squad===player?.squad;
        const factor=1-Math.exp(-dt*20);
        if(!model.userData.started||distance3(model.position,a)>4){model.position.set(a.x,a.y,a.z);model.userData.started=true;}
        else model.position.lerp(new T.Vector3(a.x,a.y,a.z),factor);
        model.rotation.y=a.yaw;model.scale.y=a.alive?(a.crouch?.75:1):.16;
        const motion=state.phase==='combat'&&a.alive?Math.sin(time*9+a.slot)*.045:0;
        model.userData.legs.rotation.z=motion;model.userData.torso.rotation.x=a.pitch*.2;
      }
      this.coreGroup.visible=state.config.mode==='core'&&!['completed','defused','none'].includes(state.core.state);
      this.coreGroup.position.set(state.core.x,0,state.core.z);this.coreMesh.rotation.y=time*.8;
      if(state.core.carrier)this.coreGroup.visible=false;
      this.coreLight.intensity=['uploading','defusing'].includes(state.core.state)?3+Math.sin(time*5):1.5;
      this.ring.visible=state.config.mode==='core';
    } else {
      for(const model of this.models.values())model.visible=false;
      this.coreGroup.visible=true;this.coreGroup.position.set(6,0,0);this.coreMesh.rotation.y=time*.3;
    }
    if(follow) {
      const h=(follow.crouch?1.07:1.57)+follow.y;
      const desired=new T.Vector3(follow.x,h,follow.z);
      if(!this.smoothPos||this.smoothPos.distanceTo(desired)>4)this.smoothPos=desired;
      else this.smoothPos.lerp(desired,1-Math.exp(-dt*25));
      this.camera.position.copy(this.smoothPos);
      this.camera.position.x+=(Math.random()-.5)*this.shake;
      this.camera.rotation.set(-(view.pitch??follow.pitch)+this.recoil*.17,view.yaw??follow.yaw,0);
      const fov=this.settings.fov*(follow.aim?.8:1);
      this.camera.fov=T.MathUtils.lerp(this.camera.fov,fov,1-Math.exp(-dt*12));this.camera.updateProjectionMatrix();
      if(this.weaponType!==follow.weapon)this.makeGun(follow.weapon);
      const bob=follow.sprinting?.018:.006;
      this.gun.position.set(follow.aim?0:.22,follow.reload>0?-.5:follow.aim?-.105:-.24+Math.sin(time*7)*bob,-.65+this.recoil*.6);
      this.gun.rotation.set(this.recoil*.8,follow.reload>0?-.55:0,follow.reload>0?-.55:-.02);
      this.muzzle.visible=this.recoil>.052;this.flash.intensity=this.muzzle.visible?1.5:0;this.flash.position.set(.2,-.2,-1);
    } else {
      this.smoothPos=null;this.camera.fov=65;this.camera.updateProjectionMatrix();
      this.camera.position.set(10.2+Math.sin(time*.07)*.4,3.7,4.6);this.camera.lookAt(1.5,1.15,-3);
    }
    this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);
    if(follow?.alive&&state?.phase!=='matchResult'&&state?.phase!=='roundResult') {
      this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.gunScene,this.gunCamera);this.renderer.autoClear=true;
    }
  }
}
function distance3(v,a){return Math.hypot(v.x-a.x,v.z-a.z);}
