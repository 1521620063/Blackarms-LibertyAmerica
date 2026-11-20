import { WEAPONS, ARMOR, clamp, direction } from './data.js';
import { wallHit } from './geometry.js';

export const eye = a => ({x:a.x,y:(a.crouch?1.07:1.57)+(a.y||0),z:a.z});
export function smokeBlocks(smokes,from,to) {
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,len=dx*dx+dy*dy+dz*dz;
  return smokes.some(s=>{
    const t=len?clamp(((s.x-from.x)*dx+(s.y-from.y)*dy+(s.z-from.z)*dz)/len,0,1):0;
    return Math.hypot(from.x+dx*t-s.x,from.y+dy*t-s.y,from.z+dz*t-s.z)<s.radius;
  });
}
export function clearRay(from,to) {
  const length=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
  return length<.001||wallHit(from,{x:(to.x-from.x)/length,y:(to.y-from.y)/length,z:(to.z-from.z)/length})>length-.05;
}
export function throwGrenade(match,a,pose=a) {
  const w=WEAPONS[a.weapon],origin=eye(a),dir=direction(pose.yaw,clamp(pose.pitch+.18,-1.2,1.35));
  a.ammo[a.weapon].mag--;a.cooldown=60/w.rpm;
  const p={id:++match.projectileId,actor:a.id,weapon:a.weapon,...origin,vx:dir.x*w.speed,vy:dir.y*w.speed+2,vz:dir.z*w.speed,fuse:w.fuse};
  match.projectiles.push(p);match.emit('throw',{actor:a.id,weapon:a.weapon,origin});
  return true;
}
function bounce(p,dt) {
  p.vy-=9.8*dt;
  // Swept axis collision prevents fast projectiles passing through thin walls.
  for(const [axis,velocity] of [['x','vx'],['y','vy'],['z','vz']]) {
    const delta=p[velocity]*dt;if(Math.abs(delta)<1e-8)continue;
    const dir={x:0,y:0,z:0};dir[axis]=Math.sign(delta);
    const hit=wallHit(p,dir),travel=Math.abs(delta);
    if(hit<=travel+.09){p[axis]+=dir[axis]*Math.max(0,hit-.095);p[velocity]*=-.45;if(axis==='y'){p.vx*=.72;p.vz*=.72;}}
    else p[axis]+=delta;
  }
}
export function updateGrenades(match,dt) {
  for(const a of match.actors)a.flash=Math.max(0,(a.flash||0)-dt);
  match.smokes=match.smokes.filter(s=>(s.remaining-=dt)>0);
  for(const p of match.projectiles) {
    const steps=Math.ceil(dt/.01);for(let i=0;i<steps;i++)bounce(p,dt/steps);
    p.fuse-=dt;if(p.fuse>0)continue;
    const w=WEAPONS[p.weapon],source=match.actors.find(a=>a.id===p.actor);
    match.emit('detonate',{actor:p.actor,weapon:p.weapon,origin:{x:p.x,y:p.y,z:p.z},radius:w.range});
    if(p.weapon==='smoke') {
      match.smokes.push({id:p.id,x:p.x,y:Math.max(.9,p.y),z:p.z,radius:w.range,remaining:w.duration});
      continue;
    }
    for(const a of match.actors) {
      if(!a.alive)continue;
      const target=eye(a),d=Math.hypot(p.x-target.x,p.y-target.y,p.z-target.z);
      if(d>=w.range||!clearRay(p,target))continue;
      if(p.weapon==='grenade') {
        if(a.squad!==source?.squad)match.damage(a,w.damage*(1-d/w.range)*(1-ARMOR[a.armor].protection),source,'blast');
      } else if(!smokeBlocks(match.smokes,p,target)) {
        const view=direction(a.yaw,a.pitch),facing=d>.001?(view.x*(p.x-target.x)+view.y*(p.y-target.y)+view.z*(p.z-target.z))/d:1;
        a.flash=Math.max(a.flash||0,w.duration*(1-d/w.range)*(facing>.35?1:.25));
        match.emit('blind',{actor:a.id,source:p.actor,duration:a.flash});
      }
    }
  }
  match.projectiles=match.projectiles.filter(p=>p.fuse>0);
}
