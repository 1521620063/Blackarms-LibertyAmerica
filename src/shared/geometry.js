import { BOXES, clamp, distance } from './data.js';

export const RADIUS = .29;
export function walkable(x,z,r=RADIUS) {
  return x>-15.75+r && x<15.75-r && z>-9.75+r && z<9.75-r && !BOXES.some(b => {
    const dx=x-clamp(x,b.minX,b.maxX), dz=z-clamp(z,b.minZ,b.maxZ);
    return dx*dx+dz*dz<r*r;
  });
}
export function move(actor,dx,dz) {
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
  for(let i=0;i<n;i++) {
    if(walkable(actor.x+dx/n,actor.z)) actor.x+=dx/n;
    if(walkable(actor.x,actor.z+dz/n)) actor.z+=dz/n;
  }
}
export function rayBox(origin,dir,b) {
  let near=0, far=Infinity;
  for(const [p,d,lo,hi] of [[origin.x,dir.x,b.minX,b.maxX],[origin.y,dir.y,0,b.h],[origin.z,dir.z,b.minZ,b.maxZ]]) {
    if(Math.abs(d)<1e-9) { if(p<lo || p>hi) return Infinity; continue; }
    let a=(lo-p)/d, c=(hi-p)/d;
    if(a>c) [a,c]=[c,a];
    near=Math.max(near,a); far=Math.min(far,c);
    if(near>far) return Infinity;
  }
  return far>=0 ? near : Infinity;
}
export function wallHit(o,d) {
  let hit=Infinity;
  for(const b of BOXES) hit=Math.min(hit,rayBox(o,d,b));
  if(d.y<0) hit=Math.min(hit,-o.y/d.y);
  if(d.y>0) hit=Math.min(hit,(5.6-o.y)/d.y);
  return hit;
}
export function visible(a,b) {
  const o={x:a.x,y:(a.crouch?1.07:1.42)+(a.y||0),z:a.z}, t={x:b.x,y:(b.crouch?.94:1.25)+(b.y||0),z:b.z};
  const len=Math.hypot(t.x-o.x,t.y-o.y,t.z-o.z);
  return wallHit(o,{x:(t.x-o.x)/len,y:(t.y-o.y)/len,z:(t.z-o.z)/len})>len-.2;
}
export function raySphere(o,d,c,r) {
  const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z;
  const b=x*d.x+y*d.y+z*d.z, det=b*b-(x*x+y*y+z*z-r*r);
  if(det<0) return Infinity;
  const t=-b-Math.sqrt(det);
  return t>=0?t:Infinity;
}

// A* on a shared, clearance-tested half-metre navigation grid.
const STEP=.5, WIDTH=63, HEIGHT=39;
const nodes=Array.from({length:WIDTH*HEIGHT},(_,i)=>({x:-15.5+(i%WIDTH)*STEP,z:-9.5+Math.floor(i/WIDTH)*STEP}));
const valid=nodes.map(p=>walkable(p.x,p.z,.36));
const neighbors=nodes.map((_,i)=>{
  if(!valid[i]) return [];
  const x=i%WIDTH,z=Math.floor(i/WIDTH), out=[];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const nx=x+dx,nz=z+dz,j=nz*WIDTH+nx;
    if(nx<0||nx>=WIDTH||nz<0||nz>=HEIGHT||!valid[j]) continue;
    if(dx&&dz&&(!valid[z*WIDTH+nx]||!valid[nz*WIDTH+x])) continue;
    out.push([j,dx&&dz?Math.SQRT2:1]);
  }
  return out;
});
function nearest(p) {
  let best=-1,dist=Infinity;
  for(let i=0;i<nodes.length;i++) if(valid[i]) {
    const d=distance(p,nodes[i]); if(d<dist) {best=i; dist=d;}
  }
  return best;
}
export function findPath(from,to) {
  const start=nearest(from),end=nearest(to);
  if(start<0||end<0) return [];
  const open=new Set([start]),came=new Map(),g=new Map([[start,0]]), f=new Map([[start,distance(nodes[start],nodes[end])/STEP]]);
  while(open.size) {
    let current=-1,best=Infinity;
    for(const i of open) if(f.get(i)<best) {best=f.get(i); current=i;}
    if(current===end) {
      const path=[nodes[end]]; let c=end;
      while(came.has(c)) {c=came.get(c); path.push(nodes[c]);}
      return path.reverse().slice(1);
    }
    open.delete(current);
    for(const [j,cost] of neighbors[current]) {
      const candidate=g.get(current)+cost;
      if(candidate<(g.get(j)??Infinity)) {
        came.set(j,current); g.set(j,candidate); f.set(j,candidate+distance(nodes[j],nodes[end])/STEP); open.add(j);
      }
    }
  }
  return [];
}
