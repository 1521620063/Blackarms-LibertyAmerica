import * as T from 'three';
import { BOXES } from '../shared/data.js';

class ParticlePool {
  constructor(scene,count,additive){
    this.count=count;this.cursor=0;this.particles=Array.from({length:count},()=>({life:0}));
    this.positions=new Float32Array(count*3);this.colors=new Float32Array(count*3);this.sizes=new Float32Array(count);this.alphas=new Float32Array(count);
    this.geometry=new T.BufferGeometry();for(const [name,array,size] of [['position',this.positions,3],['color',this.colors,3],['size',this.sizes,1],['alpha',this.alphas,1]])this.geometry.setAttribute(name,new T.BufferAttribute(array,size).setUsage(T.DynamicDrawUsage));
    this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:additive?T.AdditiveBlending:T.NormalBlending,uniforms:{scale:{value:600}},
      vertexShader:'attribute vec3 color; attribute float size; attribute float alpha; varying vec3 vColor; varying float vAlpha; uniform float scale; void main(){vColor=color;vAlpha=alpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(size*scale/max(0.1,-mv.z),1.0,110.0);gl_Position=projectionMatrix*mv;}',
      fragmentShader:`varying vec3 vColor; varying float vAlpha; void main(){float d=length(gl_PointCoord-.5)*2.0;if(d>1.0)discard;float soft=pow(1.0-d,${additive?'2.0':'1.6'});gl_FragColor=vec4(vColor,vAlpha*soft);}`});
    this.mesh=new T.Points(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=2;scene.add(this.mesh);
  }
  emit(p,v,color,size,life,gravity=0){
    const i=this.cursor++%this.count,particle=this.particles[i];Object.assign(particle,{x:p.x,y:p.y,z:p.z,vx:v.x,vy:v.y,vz:v.z,size,life,max:life,gravity});
    const c=new T.Color(color);this.colors.set([c.r,c.g,c.b],i*3);
  }
  update(dt){
    for(let i=0;i<this.count;i++){
      const p=this.particles[i];if(p.life<=0){this.alphas[i]=0;this.sizes[i]=0;continue;}
      p.life-=dt;p.vy-=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      this.positions.set([p.x,p.y,p.z],i*3);this.alphas[i]=Math.max(0,p.life/p.max);this.sizes[i]=p.size*(1+(1-p.life/p.max)*(p.gravity?0:2));
    }
    for(const name of ['position','color','alpha','size'])this.geometry.attributes[name].needsUpdate=true;
  }
}

export class CombatEffects {
  constructor(scene,settings){
    this.scene=scene;this.settings=settings;this.spark=new ParticlePool(scene,1400,true);this.smoke=new ParticlePool(scene,320,false);this.traces=[];this.decals=[];this.lightCursor=0;
    this.lights=Array.from({length:4},()=>{const light=new T.PointLight(0xffb966,0,5,2);scene.add(light);return {light,life:0};});
    this.decalGeometry=new T.PlaneGeometry(1,1);this.decalMaterial=this.makeDecal();
    const geo=new T.CylinderGeometry(.012,.012,.065,8),mat=new T.MeshStandardMaterial({color:0xc39b52,metalness:.8,roughness:.3});
    this.casings=new T.InstancedMesh(geo,mat,40);this.casings.instanceMatrix.setUsage(T.DynamicDrawUsage);this.casings.frustumCulled=false;scene.add(this.casings);this.shells=Array.from({length:40},()=>({life:0}));this.shellCursor=0;this.dummy=new T.Object3D();
    this.update(0);
  }
  makeDecal(){
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    const gradient=ctx.createRadialGradient(64,64,1,64,64,60);gradient.addColorStop(0,'rgba(8,12,11,.95)');gradient.addColorStop(.22,'rgba(13,17,16,.8)');gradient.addColorStop(.5,'rgba(35,38,34,.35)');gradient.addColorStop(1,'rgba(35,38,34,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    ctx.strokeStyle='rgba(12,17,15,.55)';ctx.lineWidth=2;for(let i=0;i<9;i++){const a=i*Math.PI*2/9;ctx.beginPath();ctx.moveTo(64,64);ctx.lineTo(64+Math.cos(a)*40,64+Math.sin(a)*40);ctx.stroke();}
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
    return new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,toneMapped:false});
  }
  shot(e,local){
    const origin=new T.Vector3(e.origin.x,e.origin.y,e.origin.z),end=e.traces[0]?.end;if(!end)return;
    const forward=new T.Vector3(end.x,end.y,end.z).sub(origin).normalize(),right=new T.Vector3(-forward.z,0,forward.x),muzzle=origin.clone().addScaledVector(forward,.65).addScaledVector(right,.1);muzzle.y-=.16;
    const low=this.settings.quality==='low',n=low?4:10;
    for(let i=0;i<n;i++)this.spark.emit(muzzle,{x:forward.x*(3+Math.random()*4)+(Math.random()-.5),y:forward.y*4+(Math.random()-.5),z:forward.z*(3+Math.random()*4)+(Math.random()-.5)},i%2?0xffbc62:0xffedc4,.06+Math.random()*.12,.045+Math.random()*.08);
    this.smoke.emit(muzzle,{x:forward.x*.3,y:.35,z:forward.z*.3},0x8a9696,.13,.65);
    const lamp=this.lights[this.lightCursor++%this.lights.length];lamp.light.position.copy(muzzle);lamp.life=.06;lamp.light.intensity=local?5:8;
    this.shell(origin,right,forward);
    for(const trace of e.traces){
      const target=new T.Vector3(trace.end.x,trace.end.y,trace.end.z);
      // Short visible tracer segments, rather than solid beams spanning the whole map.
      const dir=target.clone().sub(muzzle),length=dir.length();dir.normalize();
      const start=target.clone().addScaledVector(dir,-Math.min(length,1.7));
      const line=new T.Line(new T.BufferGeometry().setFromPoints([start,target]),new T.LineBasicMaterial({color:0xffd49c,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false}));this.scene.add(line);this.traces.push({mesh:line,life:.075,max:.075});
      if(this.traces.length>64)this.removeTrace(0);
      if(!trace.hit&&length>30)continue;
      const normal=this.normalAt(target,dir),count=low?3:e.weapon==='scatter'?5:12;
      for(let j=0;j<count;j++){
        const velocity={x:normal.x*(1+Math.random()*2)+(Math.random()-.5)*3,y:normal.y*2+Math.random()*2,z:normal.z*(1+Math.random()*2)+(Math.random()-.5)*3};
        this.spark.emit(target,velocity,trace.hit?0xd1c8ad:j%2?0xff9e42:0xffe5a9,.025+Math.random()*.03,.1+Math.random()*.3,5);
      }
      this.smoke.emit(target,{x:normal.x*.2,y:.15,z:normal.z*.2},trace.hit?0x8b8171:0x9a9b91,.18,trace.hit?.3:.65);
      if(!trace.hit&&normal.lengthSq()>.9)this.decal(target,normal);
    }
  }
  normalAt(point,direction){
    let distance=.09,best=null;
    for(const b of BOXES){
      if(point.x<b.minX-.06||point.x>b.maxX+.06||point.z<b.minZ-.06||point.z>b.maxZ+.06||point.y<-.06||point.y>b.h+.06)continue;
      const faces=[[Math.abs(point.x-b.minX),-1,0,0],[Math.abs(point.x-b.maxX),1,0,0],[Math.abs(point.z-b.minZ),0,0,-1],[Math.abs(point.z-b.maxZ),0,0,1],[Math.abs(point.y-b.h),0,1,0]];
      for(const [d,x,y,z] of faces)if(d<distance){distance=d;best=new T.Vector3(x,y,z);}
    }
    if(point.y<.07)return new T.Vector3(0,1,0);
    return best||direction.clone().negate();
  }
  decal(point,normal){
    const mesh=new T.Mesh(this.decalGeometry,this.decalMaterial);mesh.position.copy(point).addScaledVector(normal,.008);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);mesh.rotateZ(Math.random()*6.28);mesh.scale.setScalar(.11+Math.random()*.09);this.scene.add(mesh);this.decals.push(mesh);
    if(this.decals.length>80)this.scene.remove(this.decals.shift());
  }
  shell(origin,right,forward){
    const p=origin.clone().addScaledVector(right,.23).addScaledVector(forward,.3),i=this.shellCursor++%this.shells.length;
    this.shells[i]={x:p.x,y:p.y-.2,z:p.z,vx:right.x*(1.2+Math.random()),vy:1+Math.random(),vz:right.z*(1.2+Math.random()),life:2.5,angle:Math.random()*6};
  }
  pulse(position,color=0x80e8ff){for(let i=0;i<70;i++){const angle=Math.random()*Math.PI*2,r=Math.random()*3;this.spark.emit(position,{x:Math.cos(angle)*r,y:Math.random()*3,z:Math.sin(angle)*r},color,.04+Math.random()*.06,.4+Math.random()*.6,1);}}
  removeTrace(i){const fx=this.traces[i];this.scene.remove(fx.mesh);fx.mesh.geometry.dispose();fx.mesh.material.dispose();this.traces.splice(i,1);}
  clear(){for(let i=this.traces.length-1;i>=0;i--)this.removeTrace(i);for(const d of this.decals)this.scene.remove(d);this.decals.length=0;for(const pool of [this.spark,this.smoke])for(const p of pool.particles)p.life=0;for(const p of this.shells)p.life=0;}
  update(dt){
    this.spark.update(dt);this.smoke.update(dt);
    for(const lamp of this.lights){lamp.life-=dt;lamp.light.intensity=lamp.life>0?lamp.light.intensity*.7:0;}
    for(let i=this.traces.length-1;i>=0;i--){const f=this.traces[i];f.life-=dt;if(f.life<=0)this.removeTrace(i);else f.mesh.material.opacity=f.life/f.max;}
    for(let i=0;i<this.shells.length;i++){
      const p=this.shells[i];p.life-=dt;
      if(p.life>0){p.vy-=8*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.03){p.y=.03;p.vy=Math.abs(p.vy)*.3;p.vx*=.7;p.vz*=.7;}p.angle+=dt*12;this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.angle,p.angle*.7,1.3);this.dummy.scale.setScalar(Math.min(1,p.life*3));}
      else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();this.casings.setMatrixAt(i,this.dummy.matrix);
    }
    this.casings.instanceMatrix.needsUpdate=true;
  }
}
