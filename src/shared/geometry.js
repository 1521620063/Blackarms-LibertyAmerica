import { BOXES, MAP, clamp, distance } from './data.js';

export const RADIUS = .29;
export function walkable(x,z,r=RADIUS) {
  return x>-MAP.halfWidth+.25+r && x<MAP.halfWidth-.25-r && z>-MAP.halfDepth+.25+r && z<MAP.halfDepth-.25-r && !BOXES.some(b => {
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
  if(d.y>0) hit=Math.min(hit,(MAP.ceiling-o.y)/d.y);
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
const STEP=.5, WIDTH=MAP.width/STEP-1, HEIGHT=MAP.depth/STEP-1;
const nodes=Array.from({length:WIDTH*HEIGHT},(_,i)=>({x:-MAP.halfWidth+STEP+(i%WIDTH)*STEP,z:-MAP.halfDepth+STEP+Math.floor(i/WIDTH)*STEP}));
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
  const x=clamp(Math.round((p.x+MAP.halfWidth-STEP)/STEP),0,WIDTH-1),z=clamp(Math.round((p.z+MAP.halfDepth-STEP)/STEP),0,HEIGHT-1);
  const index=z*WIDTH+x;if(valid[index])return index;
  let best=-1,dist=Infinity;
  for(let i=0;i<nodes.length;i++) if(valid[i]) {
    const d=(p.x-nodes[i].x)**2+(p.z-nodes[i].z)**2;if(d<dist){best=i;dist=d;}
  }
  return best;
}
// A binary heap keeps long flank routes from scanning the entire open set per step.
export function findPath(from,to) {
  const start=nearest(from),end=nearest(to);
  if(start<0||end<0)return [];
  const heap=[],cost=new Float64Array(nodes.length),came=new Int32Array(nodes.length),closed=new Uint8Array(nodes.length);
  cost.fill(Infinity);came.fill(-1);cost[start]=0;
  const push=(id,score)=>{
    const item={id,score};let i=heap.length;heap.push(item);
    while(i){const p=(i-1)>>1;if(heap[p].score<=score)break;heap[i]=heap[p];i=p;}heap[i]=item;
  };
  const pop=()=>{
    const top=heap[0],last=heap.pop();if(heap.length){
      let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;if(heap[child].score>=last.score)break;heap[i]=heap[child];i=child;}heap[i]=last;
    }return top.id;
  };
  push(start,distance(nodes[start],nodes[end])/STEP);
  while(heap.length){
    const current=pop();if(closed[current])continue;
    if(current===end){const path=[];for(let c=end;c!==start;c=came[c])path.push(nodes[c]);return path.reverse();}
    closed[current]=1;
    for(const [next,step] of neighbors[current]){
      const candidate=cost[current]+step;
      if(!closed[next]&&candidate<cost[next]){cost[next]=candidate;came[next]=current;push(next,candidate+distance(nodes[next],nodes[end])/STEP);}
    }
  }
  return [];
}
