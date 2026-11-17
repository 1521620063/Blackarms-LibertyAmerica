import test from 'node:test';
import assert from 'node:assert/strict';
import { BOXES, MAP, clamp, rng } from '../frontend/src/game/data.js';
import { walkable, rayBox, findPath } from '../frontend/src/game/geometry.js';

function referenceWalkable(x,z,r){
  return x>-MAP.halfWidth+.25+r&&x<MAP.halfWidth-.25-r&&z>-MAP.halfDepth+.25+r&&z<MAP.halfDepth-.25-r&&!BOXES.some(b=>{
    const dx=x-clamp(x,b.minX,b.maxX),dz=z-clamp(z,b.minZ,b.maxZ);return dx*dx+dz*dz<r*r;
  });
}
function referenceRay(origin,dir,box){
  let near=0,far=Infinity;
  for(const [p,d,lo,hi] of [[origin.x,dir.x,box.minX,box.maxX],[origin.y,dir.y,0,box.h],[origin.z,dir.z,box.minZ,box.maxZ]]){
    if(Math.abs(d)<1e-9){if(p<lo||p>hi)return Infinity;continue;}
    let a=(lo-p)/d,b=(hi-p)/d;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;
  }
  return far>=0?near:Infinity;
}

test('spatial collision buckets match exhaustive checks at map, box and cell boundaries',()=>{
  const random=rng(12345),radii=[0,.1,.29,.36,.5,.51,1];
  const check=(x,z,r)=>assert.equal(walkable(x,z,r),referenceWalkable(x,z,r),`${x}, ${z}, radius ${r}`);
  for(const r of radii){
    for(let n=0;n<5000;n++)check((random()-.5)*(MAP.width+2),(random()-.5)*(MAP.depth+2),r);
    for(const box of BOXES)for(const delta of [-1e-8,0,1e-8]){
      check(box.minX-r+delta,box.z,r);check(box.maxX+r+delta,box.z,r);
      check(box.x,box.minZ-r+delta,r);check(box.x,box.maxZ+r+delta,r);
    }
    for(let x=-MAP.halfWidth;x<=MAP.halfWidth;x+=2)for(let z=-MAP.halfDepth;z<=MAP.halfDepth;z+=2)check(x,z,r);
  }
});

test('allocation-free ray intersections preserve parallel, inside, tangent and random hits',()=>{
  const random=rng(6789),directions=[{x:0,y:0,z:1},{x:1,y:0,z:0},{x:0,y:-1,z:0},{x:1e-10,y:0,z:-1},{x:-1,y:0,z:1e-9}];
  for(let i=0;i<20000;i++){
    const box=BOXES[i%BOXES.length],origin=i%3?{x:(random()-.5)*MAP.width,y:random()*4,z:(random()-.5)*MAP.depth}:{x:box.minX,y:0,z:box.maxZ};
    const dir=i%2?directions[i%directions.length]:{x:random()*2-1,y:random()*2-1,z:random()*2-1};
    assert.equal(rayBox(origin,dir,box),referenceRay(origin,dir,box));
  }
});

test('reused pathfinding scratch memory does not change paths retained by callers',()=>{
  const from={x:-MAP.halfWidth+2,z:0},to={x:MAP.halfWidth-2,z:0};
  const path=findPath(from,to),saved=structuredClone(path);assert.ok(path.length);
  for(let i=0;i<100;i++)findPath({x:to.x,z:i%8-4},{x:from.x,z:4-i%8});
  assert.deepEqual(path,saved);assert.deepEqual(findPath(from,to),saved);
});
