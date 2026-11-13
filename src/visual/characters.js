import * as T from 'three';
import { createOriginalSoldier, originalSoldierMaterials, loadOriginalSoldierSurfaces } from './original-soldier.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Original locally generated humans, with independently cloned skeletons for every actor.
export class SoldierModels {
  constructor(kit){this.kit=kit;this.ready=Promise.resolve().then(async()=>{
    const gltf=createOriginalSoldier();
    this.template=gltf.scene;this.clips=gltf.animations;
    const box=new T.Box3().setFromObject(this.template);this.scale=1.86/box.getSize(new T.Vector3()).y;
    this.floor=-box.min.y*this.scale;
    const defending=originalSoldierMaterials(1);
    this.sideMaterials=[0,1].map(side=>{
      const mats=new Map();this.template.traverse(o=>{if(o.isMesh&&!mats.has(o.material)){
        const m=side===0?o.material:defending.find(m=>m.userData.role===o.material.userData.role);
        m.envMapIntensity=1;mats.set(o.material,m);
      }});return mats;
    });
    this.surfaceAssets=await loadOriginalSoldierSurfaces(this.sideMaterials);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
    const gradient=ctx.createRadialGradient(32,32,3,32,32,32);gradient.addColorStop(0,'#00000070');gradient.addColorStop(1,'#00000000');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    this.contactGeometry=new T.PlaneGeometry(.64,.46);
    this.contactMaterial=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  });}
  create(side,name){
    const root=new T.Group(),body=new T.Group();root.add(body);
    const contact=new T.Mesh(this.contactGeometry,this.contactMaterial);contact.rotation.x=-Math.PI/2;contact.position.set(0,.005,-.04);root.add(contact);
    const skin=clone(this.template);skin.scale.setScalar(this.scale);skin.position.y=this.floor;body.add(skin);
    const originals=new Map();skin.traverse(o=>{if(o.isMesh){originals.set(o,o.material);o.material=this.sideMaterials[side].get(o.material);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    const mixer=new T.AnimationMixer(skin),actions={};
    for(const clip of this.clips)if(clip.name!=='TPose')actions[clip.name]=mixer.clipAction(clip).play();
    actions.Idle.setEffectiveWeight(1);actions.Walk.setEffectiveWeight(0);actions.Run.setEffectiveWeight(0);mixer.update(0);
    const aim=new T.Group();aim.position.set(.16,1.49,-.32);body.add(aim);const weapon=this.kit.weapon('rifle',aim);weapon.scale.setScalar(.78);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#d1e9e1';ctx.textAlign='center';ctx.font='600 21px Arial';ctx.fillText('⌄ '+name,128,36);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const marker=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:true}));marker.position.y=2.18;marker.scale.set(1.45,.36,1);root.add(marker);
    const arms=['Left','Right'].map(prefix=>({upper:skin.getObjectByName(`mixamorig${prefix}Arm`)||findBone(skin,`${prefix}Arm`),lower:findBone(skin,`${prefix}ForeArm`),hand:findBone(skin,`${prefix}Hand`)}));
    const legs=['Left','Right'].map(prefix=>({upper:findBone(skin,`${prefix}UpLeg`),lower:findBone(skin,`${prefix}Leg`),foot:findBone(skin,`${prefix}Foot`)}));
    const animationPose=[];skin.traverse(bone=>{if(bone.isBone)animationPose.push({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()});});
    root.userData={body,contact,skin,originals,mixer,actions,animationPose,aim,weapon,weaponType:'rifle',marker,side,arms,legs,hips:findBone(skin,'Hips'),chest:findBone(skin,'Spine2'),neck:findBone(skin,'Neck'),head:findBone(skin,'Head'),speed:0,death:0,gait:0,lastPosition:null};
    return root;
  }
  setSide(root,side){const u=root.userData;for(const [mesh,original] of u.originals)mesh.material=this.sideMaterials[side].get(original);u.side=side;}
  animate(root,a,dt){
    const u=root.userData,p=new T.Vector3(a.x,a.y,a.z),travel=u.lastPosition?Math.hypot(p.x-u.lastPosition.x,p.z-u.lastPosition.z):0;
    u.lastPosition=p;const speed=Math.min(6,travel/Math.max(dt,.001));u.speed=T.MathUtils.lerp(u.speed,speed,1-Math.exp(-dt*12));
    const move=a.alive?Math.min(1,u.speed/.8):0,run=a.sprinting?move:Math.max(0,(u.speed-3)/3);
    u.actions.Idle.setEffectiveWeight(1-move);u.actions.Walk.setEffectiveWeight(move*(1-run));u.actions.Run.setEffectiveWeight(run);
    // Restore the animation pose before applying IK. AnimationMixer may skip writing
    // unchanged keyframes, so subtracting crouch from the previous IK pose accumulates.
    for(const pose of u.animationPose){pose.bone.position.copy(pose.position);pose.bone.quaternion.copy(pose.quaternion);}
    u.actions.Walk.setEffectiveTimeScale(Math.max(.6,u.speed/2));u.actions.Run.setEffectiveTimeScale(Math.max(.7,u.speed/4.5));u.mixer.update(dt);
    for(const pose of u.animationPose){pose.position.copy(pose.bone.position);pose.quaternion.copy(pose.bone.quaternion);}
    this.kit.animateWeapon(u.weapon,a);
    if(a.weapon!==u.weaponType){u.aim.remove(u.weapon);u.weapon=this.kit.weapon(a.weapon,u.aim);u.weapon.scale.setScalar(.78);u.weaponType=a.weapon;}
    u.death=T.MathUtils.damp(u.death,a.alive?0:1,8,dt);
    u.body.rotation.z=-u.death*Math.PI*.49;u.body.position.y=u.death*.23;
    u.skin.position.y=this.floor;u.aim.position.y=1.49-(a.crouch?.37:0);
    u.chest.rotation.set((a.pitch||0)*.35,-.1,0);
    u.neck.rotation.set((a.pitch||0)*.3-.07,.1,-.08);
    u.head.rotation.set((a.pitch||0)*.35,0,0);
    u.aim.rotation.x=a.pitch||0;
    u.contact.position.y=.005-(a.y||0);u.contact.visible=a.alive&&(a.y||0)<.3;
    const supportShoulder=u.arms[0].upper.parent;supportShoulder.position.z-=.035;supportShoulder.position.x+=.012;
    root.updateMatrixWorld(true);
    if(a.alive){
      if(u.speed<.15){
        // Plant the soles, rather than assuming the ankle joint is the floor.
        const soleY=Math.min(...u.legs.flatMap(leg=>[-.153,.055].map(z=>root.worldToLocal(leg.foot.localToWorld(new T.Vector3(0,-.068,z))).y)));
        u.skin.position.y-=soleY;root.updateMatrixWorld(true);
      }
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
        const elbow=root.localToWorld(new T.Vector3(sign*(i===0?.28:.35),1.26-crouch,i===0?-.25:-.08));
        const support=a.weapon==='pistol'?[-.065,-.115,.07]:[-.072,-.105,a.weapon==='sniper'?-.32:a.weapon==='lmg'?-.31:-.29];
        const grip=i===0?support:[.054,-.1,a.weapon==='pistol'?.07:.135];
        const wrist=u.aim.localToWorld(new T.Vector3(...grip).multiplyScalar(.78));
        solveLimb(arm.upper,arm.lower,arm.hand,wrist,elbow);
        // Align the palm to the actual grip, independent of the elbow's bend plane.
        const direction=i===0?new T.Vector3(.9,.2,-.3):new T.Vector3(-.08,-1,-.1);
        const handRotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(sign,0,0),direction.normalize());
        const worldRotation=u.aim.getWorldQuaternion(new T.Quaternion()).multiply(handRotation);
        arm.hand.parent.getWorldQuaternion(inverse).invert();arm.hand.quaternion.copy(inverse.multiply(worldRotation));arm.hand.updateMatrixWorld(true);
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
