import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, sanitizeInput } from '../src/shared/match.js';
import { SPAWNS, OBJECTIVE, RULES, WEAPONS, MAP, ZONES } from '../src/shared/data.js';
import { findPath, walkable, move, visible } from '../src/shared/geometry.js';

const advance=(m,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)m.step(1/60);};
function quiet(config={mode:'core',teamSize:1}) {
  const m=new Match(config,[{id:'p',squad:0},{id:'e',squad:1}]);m.startCombat();return m;
}
test('every protected spawn can reach each route, flank and objective without crossing collision',()=>{
  for(const spawn of [...SPAWNS.attack,...SPAWNS.defense]) for(const target of [OBJECTIVE,{x:-5,z:6},{x:-5,z:0},{x:-5,z:-6},{x:6,z:7.6},
    {x:-18,z:5},{x:18,z:-5},{x:-13,z:-16},{x:0,z:-12},{x:13,z:-12},
    {x:-13,z:16},{x:-5,z:16},{x:6,z:12},{x:13,z:16}]) {
    assert.ok(walkable(spawn.x,spawn.z));const path=findPath(spawn,target);assert.ok(path.length,JSON.stringify({spawn,target}));
    assert.ok(walkable(target.x,target.z),`destination is open: ${JSON.stringify(target)}`);
    let previous=spawn;
    for(const p of path){
      for(let t=0;t<=1;t+=.2)assert.ok(walkable(previous.x+(p.x-previous.x)*t,previous.z+(p.z-previous.z)*t,.29),'route segments clear corners');
      assert.ok(walkable(p.x,p.z,.36));previous=p;
    }
    assert.ok(Math.hypot(previous.x-target.x,previous.z-target.z)<=.36,'path reaches requested destination');
  }
  for(const a of SPAWNS.attack)for(const b of SPAWNS.defense)assert.equal(visible(a,b),false,'all opposing spawn pairs are screened');
  const p={x:-12,z:0};move(p,20,0);assert.ok(p.x<-11.4,'large steps must not tunnel through spawn screen');
});
test('expanded map has no isolated walkable rooms and keeps actors inside its perimeter',()=>{
  const step=.5,key=(x,z)=>`${x},${z}`,cells=new Set();
  for(let x=-MAP.halfWidth+.5;x<MAP.halfWidth;x+=step)for(let z=-MAP.halfDepth+.5;z<MAP.halfDepth;z+=step)if(walkable(x,z,.36))cells.add(key(x,z));
  const start=SPAWNS.attack[0],seen=new Set([key(start.x,start.z)]),queue=[start];
  for(let i=0;i<queue.length;i++)for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){
    const x=queue[i].x+dx,z=queue[i].z+dz,k=key(x,z);if(cells.has(k)&&!seen.has(k)){seen.add(k);queue.push({x,z});}
  }
  assert.equal(seen.size,cells.size,'every navigable room connects to the main network');
  assert.ok(ZONES.length>=14);assert.ok(walkable(-24,12));assert.ok(walkable(24,-12));
  for(const [x,z,dx,dz] of [[-27,16,-8,0],[27,16,8,0],[20,-17,0,-8],[20,17,0,8]]){
    const actor={x,z};move(actor,dx,dz);assert.ok(walkable(actor.x,actor.z));assert.ok(Math.abs(actor.x)<MAP.halfWidth&&Math.abs(actor.z)<MAP.halfDepth);
  }
});
test('untrusted input cannot inject positions, damage, nonfinite values, or unknown weapons',()=>{
  const i=sanitizeInput({forward:Infinity,strafe:900,yaw:NaN,pitch:100,weapon:'rocket',order:'hack',hp:999});
  assert.equal(i.forward,0);assert.equal(i.strafe,1);assert.equal(i.yaw,0);assert.equal(i.pitch,1.4);assert.equal(i.weapon,null);assert.equal(i.order,null);assert.equal(i.hp,undefined);
});
test('real hitscan consumes ammo, respects walls and teams, and reload transfers finite reserves',()=>{
  const m=quiet({mode:'elimination',teamSize:1});const [p,e]=m.actors;
  Object.assign(p,{x:6,z:1,yaw:-Math.PI/2,pitch:0,weapon:'pistol'});Object.assign(e,{x:8,z:1});
  assert.ok(m.shoot(p));assert.equal(p.ammo.pistol.mag,11);assert.ok(e.hp<100);
  const hp=e.hp;p.cooldown=0;Object.assign(p,{x:2,z:0});Object.assign(e,{x:4,z:0});m.shoot(p);assert.equal(e.hp,hp,'objective wall blocks damage');
  e.squad=p.squad;p.cooldown=0;Object.assign(p,{x:6,z:1});Object.assign(e,{x:8,z:1});m.shoot(p);assert.equal(e.hp,hp,'friendly damage disabled');
  p.ammo.pistol={mag:1,reserve:3};assert.ok(m.reloadWeapon(p));
  e.squad=1;advance(m,1.6);assert.equal(p.ammo.pistol.mag,4);assert.equal(p.ammo.pistol.reserve,0);
});
test('death, core drop, kill credit and round scoring each happen only once',()=>{
  const m=quiet();const [p,e]=m.actors;Object.assign(p,{x:-5,z:6});
  assert.equal(m.core.carrier,p.id);assert.ok(m.damage(p,200,e));assert.equal(m.damage(p,200,e),false);
  assert.equal(m.core.state,'dropped');assert.equal(m.core.carrier,null);assert.equal(m.core.x,-5);assert.equal(p.deaths,1);assert.equal(e.kills,1);
  m.evaluateElimination();assert.deepEqual(m.scores,[0,1]);assert.equal(m.endRound(1,'duplicate'),false);assert.deepEqual(m.scores,[0,1]);
});
test('pickup, movement/release/damage cancellation, planting, upload during defuse and completion',()=>{
  const m=quiet();const [p,e]=m.actors;Object.assign(p,{x:6,z:0});
  p.input.interact=true;m.interact(p,2);assert.equal(m.core.state,'planting');p.x+=.5;m.interact(p,.1);assert.equal(m.core.state,'carried');assert.equal(m.core.progress,0);
  p.x=6;m.interact(p,2);m.damage(p,1,e);assert.equal(m.core.state,'carried');
  m.interact(p,2);p.input.interact=false;m.updateObjective(.1);assert.equal(m.core.progress,0);
  m.dropCore(p);m.interact(p,.1);assert.equal(m.core.carrier,p.id);
  p.input.interact=true;m.interact(p,5.01);assert.equal(m.core.state,'uploading');assert.equal(m.core.carrier,null);
  Object.assign(e,{x:6,z:0});e.input.interact=true;m.interact(e,2);m.updateObjective(2);assert.equal(m.core.state,'defusing');assert.equal(m.core.upload,28);
  e.input.interact=false;m.updateObjective(.1);assert.equal(m.core.state,'uploading');
  e.input.interact=true;m.interact(e,5.01);assert.equal(m.core.state,'defused');assert.equal(m.result.winner,1);assert.equal(m.result.reason,'数据核心已拆除');
  const n=quiet();n.core={state:'uploading',carrier:null,x:6,z:0,progress:0,upload:.1,interactor:null};n.remaining=0;
  advance(n,.2);assert.equal(n.result.winner,0);assert.equal(n.core.state,'completed');
});
test('attackers may finish planted upload after death; defense wins unplanted timeout',()=>{
  const m=quiet();const [p,e]=m.actors;m.core={state:'uploading',carrier:null,x:6,z:0,progress:0,upload:2,interactor:null};
  m.damage(p,200,e);m.evaluateElimination();assert.equal(m.phase,'combat');advance(m,2.1);assert.equal(m.result.winner,0);
  const n=quiet();n.remaining=0;n.step(1/60);assert.equal(n.result.winner,1);
});
test('elimination timeout uses living count, health, then one overtime and draw',()=>{
  const m=quiet({mode:'elimination',teamSize:1});m.timeout();assert.equal(m.overtime,true);assert.equal(m.remaining,15);m.timeout();assert.equal(m.result.winner,null);
  const n=quiet({mode:'elimination',teamSize:1});n.actors[1].hp=80;n.timeout();assert.equal(n.result.winner,0);
});
test('side changes preserve squad scores and reset health, ammo and objective',()=>{
  const m=quiet();m.endRound(0,'test');advance(m,6.1);assert.equal(m.round,2);m.startCombat();m.endRound(1,'test');advance(m,6.1);
  assert.equal(m.round,3);assert.equal(m.attackSquad,1);assert.deepEqual(m.scores,[1,1]);
  assert.equal(m.core.carrier,m.actors.find(a=>a.squad===1).id);assert.ok(m.actors.every(a=>a.hp===100&&a.alive));
});
test('bots navigate, plant, complete upload and defuse using the same objective rules',()=>{
  const m=new Match({mode:'core',teamSize:1},[{id:'e',squad:1}]);m.startCombat();const e=m.actors.find(a=>a.id==='e');Object.assign(e,{x:13.2,z:0});
  const states=new Set();for(let i=0;i<60*65&&m.phase==='combat';i++){m.step(1/60);states.add(m.core.state);}
  assert.ok(states.has('planting'));assert.ok(states.has('uploading'));assert.equal(m.core.state,'completed');
  const n=new Match({mode:'core',teamSize:1},[{id:'p',squad:0}]);n.startCombat();const p=n.actors.find(a=>a.id==='p');Object.assign(p,{x:-13,z:-8,alive:false});
  Object.assign(n.core,{state:'uploading',carrier:null,x:6,z:0,upload:30});
  for(let i=0;i<60*25&&n.phase==='combat';i++)n.step(1/60);
  assert.equal(n.core.state,'defused');assert.equal(n.result.winner,1);
});
for(const mode of ['elimination','core'])for(const size of [1,2,3])for(const difficulty of ['easy','normal','hard']) {
  test(`unattended complete match: ${mode} ${size}v${size} ${difficulty}`,()=>{
    const m=new Match({mode,teamSize:size,difficulty,seed:103+size},[]);const states=new Set();
    for(let i=0;i<60*1200&&m.phase!=='matchResult';i++){m.step(1/60);states.add(m.phase);for(const a of m.actors){assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.hp));assert.ok(walkable(a.x,a.z,.28));}}
    assert.equal(m.phase,'matchResult');assert.ok(m.scores.includes(RULES[size].wins));assert.ok(states.has('combat'));assert.ok(states.has('roundResult'));
    assert.ok(m.history.length>=RULES[size].wins);assert.equal(m.actors.length,size*2);
  });
}
