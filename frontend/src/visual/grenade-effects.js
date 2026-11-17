import * as T from 'three/webgpu';
import { attribute } from 'three/tsl';
import { rng } from '../game/data.js';

// Persistent visuals follow authoritative snapshots, including late joins.
export class GrenadeEffects {
  constructor(scene,kit){this.scene=scene;this.kit=kit;this.projectiles=new Map();this.clouds=new Map();}
  smokeMaterial(){
    if(this.material)return this.material;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0,'rgba(130,137,132,1)');g.addColorStop(.55,'rgba(130,137,132,.95)');g.addColorStop(1,'rgba(130,137,132,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    const material=new T.SpriteNodeMaterial({map,transparent:true,depthWrite:false,opacity:.95});
    material.positionNode=attribute('smokePosition','vec3');material.scaleNode=attribute('smokeScale','float');
    return this.material=material;
  }
  sync(state,time){
    const flying=new Set();
    for(const p of state?.projectiles||[]){
      flying.add(p.id);let model=this.projectiles.get(p.id);
      if(!model){model=this.kit.weapon(p.weapon,this.scene);this.projectiles.set(p.id,model);}
      model.position.set(p.x,p.y,p.z);model.rotation.set(time*5,time*3,0);
    }
    for(const [id,model] of this.projectiles)if(!flying.has(id)){model.removeFromParent();this.projectiles.delete(id);}
    const active=new Set();
    for(const s of state?.smokes||[]){
      active.add(s.id);let group=this.clouds.get(s.id);
      if(!group){
        const random=rng(s.id+937),positions=new Float32Array(32*3),scales=new Float32Array(32);
        for(let i=0;i<32;i++){
          const angle=random()*Math.PI*2,r=Math.cbrt(random())*s.radius*.65;
          positions.set([Math.cos(angle)*r,(random()-.5)*s.radius*.85,Math.sin(angle)*r],i*3);
          scales[i]=s.radius*(.85+random()*.25);
        }
        const plane=new T.PlaneGeometry(1,1),geometry=new T.InstancedBufferGeometry().copy(plane);plane.dispose();
        geometry.instanceCount=32;geometry.setAttribute('smokePosition',new T.InstancedBufferAttribute(positions,3));geometry.setAttribute('smokeScale',new T.InstancedBufferAttribute(scales,1));
        group=new T.Mesh(geometry,this.smokeMaterial());group.frustumCulled=false;
        this.scene.add(group);this.clouds.set(s.id,group);
      }
      group.position.set(s.x,s.y,s.z);group.rotation.y=time*.025;
      group.scale.setScalar(Math.min(1,s.remaining/1.5));
    }
    for(const [id,group] of this.clouds)if(!active.has(id)){group.removeFromParent();group.geometry.dispose();this.clouds.delete(id);}
  }
  clear(){this.sync(null,0);}
}
