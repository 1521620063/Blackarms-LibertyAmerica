import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../frontend/src/game/match.js';
import { WEAPONS, PRIMARY_WEAPONS } from '../frontend/src/game/data.js';
import { eye, smokeBlocks, updateGrenades } from '../frontend/src/game/grenades.js';

function fixture(){
  const match=new Match({teamSize:1},[{id:'player',squad:0},{id:'enemy',squad:1}]);
  const [player,enemy]=match.actors;
  Object.assign(player,{x:6,z:1,yaw:-Math.PI/2,pitch:0});
  Object.assign(enemy,{x:8,z:1,yaw:Math.PI/2,pitch:0,hp:1000});
  match.startCombat();return {match,player,enemy};
}
function detonate(match,weapon,x,y,z){match.projectiles.push({id:++match.projectileId,actor:'player',weapon,x,y,z,vx:0,vy:0,vz:0,fuse:0});updateGrenades(match,.01);}

test('throwables have limited inventory, require separate presses and reset each round',()=>{
  for(const type of ['grenade','smoke','flash']){
    const {match,player}=fixture();player.weapon=type;
    assert.ok(!PRIMARY_WEAPONS.includes(type));assert.equal(match.reloadWeapon(player),false);
    match.setInput('player',{fire:true,yaw:player.yaw});
    for(let i=0;i<100;i++)match.step(.01);
    assert.equal(player.ammo[type].mag,WEAPONS[type].mag-1);
    assert.equal(match.events.filter(e=>e.type==='throw').length,1);
    assert.ok(!match.events.some(e=>e.type==='shot'));
    match.resetRound();assert.equal(player.ammo[type].mag,WEAPONS[type].mag);
    assert.equal(player.flash,0);assert.equal(match.projectiles.length,0);assert.equal(match.smokes.length,0);
  }
});

test('grenades bounce off thin walls and detonate only after the fuse',()=>{
  const {match,player}=fixture();Object.assign(player,{x:-12,z:0,yaw:-Math.PI/2,weapon:'grenade'});
  assert.ok(match.shoot(player));assert.equal(match.shoot(player),false);
  for(let i=0;i<20;i++)updateGrenades(match,.01);
  assert.ok(match.projectiles[0].x<-11.2,'projectile must bounce off the spawn screen');
  assert.ok(match.projectiles[0].vx<0);
  assert.ok(!match.events.some(e=>e.type==='detonate'));
  for(let i=0;i<240;i++)updateGrenades(match,.01);
  assert.equal(match.projectiles.length,0);assert.ok(match.events.some(e=>e.type==='detonate'));
});

test('fragmentation damages enemies with falloff, credits kills and respects walls and teammates',()=>{
  const close=fixture();detonate(close.match,'grenade',7.8,1.5,1);
  assert.ok(close.enemy.hp<900);assert.equal(close.player.hp,100);assert.ok(close.player.damage>100);
  const far=fixture();detonate(far.match,'grenade',5,1.5,1);assert.ok(far.enemy.hp>close.enemy.hp);
  const blocked=fixture();Object.assign(blocked.enemy,{x:-10,z:0});detonate(blocked.match,'grenade',-12,1.5,0);assert.equal(blocked.enemy.hp,1000);
  const lethal=fixture();lethal.enemy.hp=50;detonate(lethal.match,'grenade',7.8,1.5,1);
  assert.equal(lethal.player.kills,1);assert.equal(lethal.player.headshots,0);assert.equal(lethal.enemy.alive,false);
});

test('smoke persists, blocks AI vision and expires without causing damage',()=>{
  const {match,player,enemy}=fixture();enemy.bot=true;
  match.think(enemy,.01);assert.equal(enemy.target,player.id);
  detonate(match,'smoke',7,1,1);
  assert.equal(match.smokes.length,1);assert.equal(enemy.hp,1000);
  assert.ok(smokeBlocks(match.smokes,eye(player),eye(enemy)));
  match.think(enemy,.01);assert.equal(enemy.target,null);assert.equal(enemy.input.fire,false);
  updateGrenades(match,14.1);assert.equal(match.smokes.length,0);
  match.think(enemy,.01);assert.equal(enemy.target,player.id);
});

test('flash duration depends on distance and facing; walls and smoke block it, AI cannot see while blinded',()=>{
  const front=fixture();detonate(front.match,'flash',7,1.5,1);assert.ok(front.enemy.flash>3);
  const back=fixture();back.enemy.yaw=-Math.PI/2;detonate(back.match,'flash',7,1.5,1);
  assert.ok(back.enemy.flash<front.enemy.flash*.3);assert.equal(front.enemy.hp,1000);
  front.enemy.bot=true;front.match.think(front.enemy,.01);assert.equal(front.enemy.target,null);
  const blocked=fixture();Object.assign(blocked.enemy,{x:-10,z:0});detonate(blocked.match,'flash',-12,1.5,0);assert.equal(blocked.enemy.flash,0);
  const smoke=fixture();detonate(smoke.match,'smoke',7,1,1);detonate(smoke.match,'flash',7,1.5,1);assert.equal(smoke.enemy.flash,0);
  updateGrenades(front.match,5);assert.equal(front.enemy.flash,0);
});
