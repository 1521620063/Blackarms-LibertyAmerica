import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// A textured, skinned human model with independently cloned skeletons for every actor.
export class SoldierModels {
  constructor(kit){this.kit=kit;this.ready=new GLTFLoader().loadAsync('/models/soldier.glb').then(gltf=>{
    this.template=gltf.scene;this.clips=gltf.animations;
    const box=new T.Box3().setFromObject(this.template);this.scale=1.86/box.getSize(new T.Vector3()).y;
    this.floor=-box.min.y*this.scale;
    this.sideMaterials=[0,1].map(side=>{
      const mats=new Map();this.template.traverse(o=>{if(o.isMesh&&!mats.has(o.material)){
        const m=o.material.clone();m.color.multiply(new T.Color(side===0?0xadc3bb:0xd0b995));m.roughness=.82;m.metalness=.12;m.envMapIntensity=.7;mats.set(o.material,m);
      }});return mats;
    });
  });}
  create(side,name){
    const root=new T.Group(),body=new T.Group();root.add(body);
    const skin=clone(this.template);skin.scale.setScalar(this.scale);skin.position.y=this.floor;body.add(skin);
    const originals=new Map();skin.traverse(o=>{if(o.isMesh){originals.set(o,o.material);o.material=this.sideMaterials[side].get(o.material);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    const mixer=new T.AnimationMixer(skin),actions={};
    for(const clip of this.clips)if(clip.name!=='TPose')actions[clip.name]=mixer.clipAction(clip).play();
    actions.Idle.setEffectiveWeight(1);actions.Walk.setEffectiveWeight(0);actions.Run.setEffectiveWeight(0);mixer.update(0);
    const aim=new T.Group();aim.position.set(.1,1.25,-.27);body.add(aim);const weapon=this.kit.weapon('rifle',aim);weapon.scale.setScalar(.78);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#d1e9e1';ctx.textAlign='center';ctx.font='600 21px Arial';ctx.fillText('⌄ '+name,128,36);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const marker=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:true}));marker.position.y=2.18;marker.scale.set(1.45,.36,1);root.add(marker);
    const arms=['Left','Right'].map(prefix=>({upper:skin.getObjectByName(`mixamorig${prefix}Arm`)||findBone(skin,`${prefix}Arm`),lower:findBone(skin,`${prefix}ForeArm`),hand:findBone(skin,`${prefix}Hand`)}));
    const legs=['Left','Right'].map(prefix=>({upper:findBone(skin,`${prefix}UpLeg`),lower:findBone(skin,`${prefix}Leg`),foot:findBone(skin,`${prefix}Foot`)}));
    root.userData={body,skin,originals,mixer,actions,aim,weapon,weaponType:'rifle',marker,side,arms,legs,hips:findBone(skin,'Hips'),speed:0,death:0,gait:0,lastPosition:null};
    return root;
  }
  setSide(root,side){const u=root.userData;for(const [mesh,original] of u.originals)mesh.material=this.sideMaterials[side].get(original);u.side=side;}
  animate(root,a,dt){
    const u=root.userData,p=new T.Vector3(a.x,a.y,a.z),travel=u.lastPosition?Math.hypot(p.x-u.lastPosition.x,p.z-u.lastPosition.z):0;
    u.lastPosition=p;const speed=Math.min(6,travel/Math.max(dt,.001));u.speed=T.MathUtils.lerp(u.speed,speed,1-Math.exp(-dt*12));
    const move=a.alive?Math.min(1,u.speed/.8):0,run=a.sprinting?move:Math.max(0,(u.speed-3)/3);
    u.actions.Idle.setEffectiveWeight(1-move);u.actions.Walk.setEffectiveWeight(move*(1-run));u.actions.Run.setEffectiveWeight(run);
    u.actions.Walk.setEffectiveTimeScale(Math.max(.6,u.speed/2));u.actions.Run.setEffectiveTimeScale(Math.max(.7,u.speed/4.5));u.mixer.update(dt);
    if(a.weapon!==u.weaponType){u.aim.remove(u.weapon);u.weapon=this.kit.weapon(a.weapon,u.aim);u.weapon.scale.setScalar(.78);u.weaponType=a.weapon;}
    u.death=T.MathUtils.damp(u.death,a.alive?0:1,8,dt);
    u.body.rotation.z=-u.death*Math.PI*.49;u.body.position.y=u.death*.23;
    u.skin.position.y=this.floor;u.aim.position.y=1.25-(a.crouch?.37:0);
    u.aim.rotation.x=a.pitch;
    root.updateMatrixWorld(true);
    if(a.alive){
      if(a.crouch&&u.hips){
        const feet=u.legs.map(leg=>leg.foot.getWorldPosition(new T.Vector3()));
        const rotations=u.legs.map(leg=>leg.foot.getWorldQuaternion(new T.Quaternion()));
        u.hips.position.y-=.37/this.scale;root.updateMatrixWorld(true);
        u.legs.forEach((leg,i)=>{
          const pole=root.localToWorld(new T.Vector3(i===0?-.15:.15,.4,-.5));
          solveLimb(leg.upper,leg.lower,leg.foot,feet[i],pole);
          leg.foot.parent.getWorldQuaternion(inverse).invert();leg.foot.quaternion.copy(inverse.multiply(rotations[i]));leg.foot.updateMatrixWorld(true);
        });
      }
      for(let i=0;i<u.arms.length;i++){
        const arm=u.arms[i];if(!arm.upper||!arm.lower||!arm.hand)continue;
        const crouch=a.crouch?.37:0,sign=i===0?-1:1;
        const elbow=root.localToWorld(new T.Vector3(sign*.34,1.08-crouch,-.12));
        const wrist=u.aim.localToWorld(new T.Vector3(i===0?-.055:.015,i===0?-.08:-.13,i===0?-.31:.08));
        solveLimb(arm.upper,arm.lower,arm.hand,wrist,elbow);
      }
    }
  }
  release(root){root.userData.mixer.stopAllAction();root.userData.mixer.uncacheRoot(root.userData.skin);root.userData.marker.material.map.dispose();root.userData.marker.material.dispose();}
}
function findBone(root,suffix){let found;root.traverse(o=>{if(o.isBone&&o.name.endsWith(suffix))found=o;});return found;}
const origin=new T.Vector3(),inverse=new T.Quaternion(),axis=new T.Vector3(),targetDirection=new T.Vector3();
function solveLimb(upper,lower,end,target,pole){
  const start=upper.getWorldPosition(new T.Vector3()),joint=lower.getWorldPosition(new T.Vector3()),tip=end.getWorldPosition(new T.Vector3());
  const a=start.distanceTo(joint),b=joint.distanceTo(tip),delta=target.clone().sub(start),distance=Math.max(.001,Math.min(a+b-.001,Math.max(Math.abs(a-b)+.001,delta.length())));
  const forward=delta.normalize(),bend=pole.clone().sub(start);bend.addScaledVector(forward,-bend.dot(forward));if(bend.lengthSq()<.0001)bend.set(0,0,1);bend.normalize();
  const cos=T.MathUtils.clamp((a*a+distance*distance-b*b)/(2*a*distance),-1,1),knee=start.clone().addScaledVector(forward,a*cos).addScaledVector(bend,a*Math.sqrt(1-cos*cos));
  pointBone(upper,lower,knee);pointBone(lower,end,target);
}
function pointBone(bone,child,target){
  bone.getWorldPosition(origin);bone.parent.getWorldQuaternion(inverse).invert();
  targetDirection.copy(target).sub(origin).normalize().applyQuaternion(inverse);axis.copy(child.position).normalize();
  bone.quaternion.setFromUnitVectors(axis,targetDirection);bone.updateMatrixWorld(true);
}
