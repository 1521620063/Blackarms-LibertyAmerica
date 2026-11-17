import { BOXES, MAP, clamp, distance } from './data.js';

export const RADIUS = .29;
const CELL=2,COLS=Math.ceil(MAP.width/CELL),ROWS=Math.ceil(MAP.depth/CELL),CLEARANCE=.5;
const collisionCells=Array.from({length:COLS*ROWS},()=>[]);
for(const box of BOXES){
  const minX=clamp(Math.floor((box.minX-CLEARANCE+MAP.halfWidth)/CELL),0,COLS-1),maxX=clamp(Math.floor((box.maxX+CLEARANCE+MAP.halfWidth)/CELL),0,COLS-1);
  const minZ=clamp(Math.floor((box.minZ-CLEARANCE+MAP.halfDepth)/CELL),0,ROWS-1),maxZ=clamp(Math.floor((box.maxZ+CLEARANCE+MAP.halfDepth)/CELL),0,ROWS-1);
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)collisionCells[z*COLS+x].push(box);
}
export function walkable(x,z,r=RADIUS) {
  if(!(x>-MAP.halfWidth+.25+r&&x<MAP.halfWidth-.25-r&&z>-MAP.halfDepth+.25+r&&z<MAP.halfDepth-.25-r))return false;
  // Static map buckets include enough clearance for all normal actor radii.
  const boxes=r>=0&&r<=CLEARANCE?collisionCells[Math.floor((z+MAP.halfDepth)/CELL)*COLS+Math.floor((x+MAP.halfWidth)/CELL)]:BOXES;
  for(let i=0;i<boxes.length;i++){
    const b=boxes[i],dx=x-clamp(x,b.minX,b.maxX),dz=z-clamp(z,b.minZ,b.maxZ);
    if(dx*dx+dz*dz<r*r)return false;
  }
  return true;
}
export function move(actor,dx,dz) {
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
  for(let i=0;i<n;i++) {
    if(walkable(actor.x+dx/n,actor.z)) actor.x+=dx/n;
    if(walkable(actor.x,actor.z+dz/n)) actor.z+=dz/n;
  }
}
export function rayBox(origin,dir,b) {
  // Slab intersection without temporary arrays in this frequently called path.
  let near=0,far=Infinity;
  if(Math.abs(dir.x)<1e-9){if(origin.x<b.minX||origin.x>b.maxX)return Infinity;}
  else{
    const a=(b.minX-origin.x)/dir.x,c=(b.maxX-origin.x)/dir.x;
    near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));if(near>far)return Infinity;
  }
  if(Math.abs(dir.y)<1e-9){if(origin.y<0||origin.y>b.h)return Infinity;}
  else{
    const a=-origin.y/dir.y,c=(b.h-origin.y)/dir.y;
    near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));if(near>far)return Infinity;
  }
  if(Math.abs(dir.z)<1e-9){if(origin.z<b.minZ||origin.z>b.maxZ)return Infinity;}
  else{
    const a=(b.minZ-origin.z)/dir.z,c=(b.maxZ-origin.z)/dir.z;
    near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));if(near>far)return Infinity;
  }
  return far>=0?near:Infinity;
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
// Searches run synchronously; reuse scratch storage without sharing returned paths.
const cost=new Float64Array(nodes.length),came=new Int32Array(nodes.length),seen=new Uint32Array(nodes.length),closed=new Uint32Array(nodes.length);
const heapIds=[],heapScores=[];let searchId=0;
export function findPath(from,to) {
  const start=nearest(from),end=nearest(to);
  if(start<0||end<0)return [];
  searchId=(searchId+1)>>>0;if(!searchId){seen.fill(0);closed.fill(0);searchId=1;}
  heapIds.length=0;heapScores.length=0;cost[start]=0;seen[start]=searchId;
  const push=(id,score)=>{
    let i=heapIds.length;heapIds.push(id);heapScores.push(score);
    while(i){const p=(i-1)>>1;if(heapScores[p]<=score)break;heapIds[i]=heapIds[p];heapScores[i]=heapScores[p];i=p;}
    heapIds[i]=id;heapScores[i]=score;
  };
  const pop=()=>{
    const top=heapIds[0],lastId=heapIds.pop(),lastScore=heapScores.pop();if(heapIds.length){
      let i=0;while(i*2+1<heapIds.length){let child=i*2+1;if(child+1<heapIds.length&&heapScores[child+1]<heapScores[child])child++;if(heapScores[child]>=lastScore)break;heapIds[i]=heapIds[child];heapScores[i]=heapScores[child];i=child;}
      heapIds[i]=lastId;heapScores[i]=lastScore;
    }return top;
  };
  push(start,distance(nodes[start],nodes[end])/STEP);
  while(heapIds.length){
    const current=pop();if(closed[current]===searchId)continue;
    if(current===end){const path=[];for(let c=end;c!==start;c=came[c])path.push(nodes[c]);return path.reverse();}
    closed[current]=searchId;
    for(const [next,step] of neighbors[current]){
      const candidate=cost[current]+step;
      if(closed[next]!==searchId&&(seen[next]!==searchId||candidate<cost[next])){
        cost[next]=candidate;came[next]=current;seen[next]=searchId;push(next,candidate+distance(nodes[next],nodes[end])/STEP);
      }
    }
  }
  return [];
}
