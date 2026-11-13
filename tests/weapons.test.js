import test from 'node:test';
import assert from 'node:assert/strict';
import { Match,sanitizeInput } from '../src/shared/match.js';
import { WEAPONS,WEAPON_ORDER,PRIMARY_WEAPONS } from '../src/shared/data.js';

function fixture(primary='rifle'){
  const match=new Match({teamSize:1,primary},[{id:'player',squad:0},{id:'enemy',squad:1}]);
  const [player,enemy]=match.actors;
  Object.assign(player,{x:6,z:1,yaw:-Math.PI/2,pitch:0,weapon:primary});Object.assign(enemy,{x:8,z:1,hp:10000});
  match.startCombat();return {match,player,enemy};
}
function advance(match,seconds){for(let i=0;i<Math.ceil(seconds/.01);i++)match.step(.01);}

test('all seven weapons validate, initialize independent ammo and support primary loadouts',()=>{
  assert.equal(WEAPON_ORDER.length,7);
  for(const type of WEAPON_ORDER){
    assert.equal(sanitizeInput({weapon:type}).weapon,type);
    const {player}=fixture(type);
    assert.equal(Object.keys(player.ammo).length,7);
    assert.equal(player.ammo[type].mag,WEAPONS[type].mag);
  }
  for(const type of PRIMARY_WEAPONS){
    const match=new Match({teamSize:1,primary:type});assert.equal(match.actors[0].weapon,type);
    assert.ok(match.setLoadout('player','sniper','heavy'));assert.equal(match.actors[0].weapon,'sniper');
  }
  assert.equal(sanitizeInput({weapon:'toString'}).weapon,null);
  assert.equal(sanitizeInput({weapon:'rocket'}).weapon,null);
});

test('switching cancels reload, retains each magazine and blocks firing while drawing',()=>{
  const {match,player}=fixture();player.ammo.rifle.mag=3;
  assert.ok(match.reloadWeapon(player));
  match.setInput('player',{weapon:'smg',yaw:player.yaw});match.step(.01);
  assert.equal(player.weapon,'smg');assert.equal(player.reload,0);assert.ok(player.switchTime>0);
  assert.equal(match.shoot(player),false);assert.equal(match.reloadWeapon(player),false);
  advance(match,.3);assert.ok(match.shoot(player));assert.equal(player.ammo.smg.mag,31);
  match.setInput('player',{weapon:'rifle',yaw:player.yaw});match.step(.01);advance(match,.4);
  assert.equal(player.ammo.rifle.mag,3);assert.equal(player.ammo.rifle.reserve,120);
  match.setInput('player',{weapon:'smg',yaw:player.yaw});match.step(.01);advance(match,.3);
  assert.equal(player.ammo.smg.mag,31);
});

test('DMR and sniper require separate trigger presses; automatic weapons sustain fire',()=>{
  for(const type of ['dmr','sniper','smg','lmg']){
    const {match,player}=fixture(type),mag=player.ammo[type].mag;
    match.setInput('player',{fire:true,aim:true,yaw:player.yaw});advance(match,2);
    const spent=mag-player.ammo[type].mag;
    if(WEAPONS[type].semi){
      assert.equal(spent,1,type);
      match.setInput('player',{fire:false,yaw:player.yaw});match.step(.01);
      match.setInput('player',{fire:true,yaw:player.yaw});match.step(.01);
      assert.equal(player.ammo[type].mag,mag-2,type);
    }else assert.ok(spent>3,type);
  }
});

test('sniper bolt recovery survives switching away and back',()=>{
  const {match,player}=fixture('sniper');assert.ok(match.shoot(player));
  match.setInput('player',{weapon:'pistol',yaw:player.yaw});match.step(.01);advance(match,.33);
  match.setInput('player',{weapon:'sniper',yaw:player.yaw});match.step(.01);advance(match,.66);
  assert.equal(player.switchTime,0);assert.ok(player.cooldown>0);assert.equal(match.shoot(player),false);
  advance(match,.5);assert.ok(match.shoot(player));assert.equal(player.ammo.sniper.mag,3);
});

test('scoped sniper weakpoint hits are lethal while walls still stop them',()=>{
  const {match,player,enemy}=fixture('sniper');enemy.hp=100;player.aim=true;
  assert.ok(match.shoot(player));assert.equal(enemy.alive,false);
  assert.ok(match.events.some(e=>e.type==='kill'&&e.part==='weakpoint'));
  const blocked=fixture('sniper');Object.assign(blocked.player,{x:-3,z:0,yaw:-Math.PI/2,aim:true});Object.assign(blocked.enemy,{x:4,z:0,hp:100});
  assert.ok(blocked.match.shoot(blocked.player));assert.equal(blocked.enemy.hp,100);
});

test('heavy machine gun trades movement speed for ammunition; every reload keeps reserves finite',()=>{
  const displacement=type=>{
    const {match,player}=fixture(type),start=player.x;
    match.setInput('player',{forward:1,yaw:player.yaw});match.step(.05);return player.x-start;
  };
  assert.ok(displacement('smg')>displacement('rifle'));assert.ok(displacement('lmg')<displacement('rifle'));
  for(const type of WEAPON_ORDER){
    const {match,player}=fixture(type);player.ammo[type]={mag:0,reserve:2};assert.ok(match.reloadWeapon(player));
    advance(match,WEAPONS[type].reload+.02);assert.deepEqual(player.ammo[type],{mag:2,reserve:0});
  }
});
