import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import { GrenadeEffects } from '../frontend/src/visual/grenade-effects.js';
import { rng } from '../frontend/src/game/data.js';

test('a smoke cloud renders its deterministic billboards in a single instanced mesh',()=>{
  const scene=new T.Scene(),effects=new GrenadeEffects(scene,{});
  // A real material without a texture lets geometry and lifecycle run in Node.
  effects.material=new T.SpriteNodeMaterial();
  const smoke={id:41,x:3,y:1,z:4,radius:3,remaining:14};
  effects.sync({smokes:[smoke]},5);
  const cloud=effects.clouds.get(smoke.id);
  assert.ok(cloud.isMesh,'the entire cloud takes one draw call');
  assert.ok(cloud.geometry.isInstancedBufferGeometry);
  assert.equal(cloud.geometry.instanceCount,32);
  const positions=cloud.geometry.getAttribute('smokePosition'),scales=cloud.geometry.getAttribute('smokeScale'),random=rng(smoke.id+937);
  for(let i=0;i<32;i++){
    const angle=random()*Math.PI*2,r=Math.cbrt(random())*smoke.radius*.65;
    const expected=[Math.cos(angle)*r,(random()-.5)*smoke.radius*.85,Math.sin(angle)*r];
    expected.forEach((value,axis)=>assert.ok(Math.abs(positions.array[i*3+axis]-value)<1e-6));
    assert.ok(Math.abs(scales.getX(i)-smoke.radius*(.85+random()*.25))<1e-6);
  }
  effects.sync({smokes:[{...smoke,remaining:.75}]},8);
  assert.equal(effects.clouds.get(smoke.id),cloud,'snapshots reuse existing GPU geometry');
  assert.equal(cloud.scale.x,.5,'the cloud retains its authoritative fade');
  assert.deepEqual(cloud.position.toArray(),[3,1,4]);
  let disposed=false;cloud.geometry.addEventListener('dispose',()=>disposed=true);
  effects.clear();assert.equal(effects.clouds.size,0);assert.equal(cloud.parent,null);assert.ok(disposed,'expired cloud buffers are released');
});
