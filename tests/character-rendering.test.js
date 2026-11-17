import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { SoldierModels } from '../frontend/src/visual/characters.js';

test('hidden first-person bodies keep movement and effect clocks without posing their skeleton',()=>{
  const root=new T.Group();root.visible=false;
  root.userData={lastPosition:new T.Vector3(),speed:0,flashTime:.075,death:0};
  SoldierModels.prototype.animate(root,{x:.05,y:0,z:0,alive:false},.1);
  assert.ok(root.userData.speed>0,'movement still drives first-person weapon bob');
  assert.equal(root.userData.flashTime,0,'expired muzzle flashes cannot reappear when spectating another actor');
  assert.ok(root.userData.death>0,'death timing continues while the followed body is hidden');
});
