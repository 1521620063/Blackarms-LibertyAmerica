import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../frontend/src/game/match.js';
import { NetworkMovement, InputQueue, TriggerInput } from '../frontend/src/game/netcode.js';
import { FixedClock, SIMULATION_STEP } from '../frontend/src/game/movement.js';

function fixture(){
  const match=new Match({teamSize:1},[{id:'player',squad:0},{id:'enemy',squad:1}]);
  Object.assign(match.actors[0],{x:6,z:1,yaw:-Math.PI/2});
  Object.assign(match.actors[1],{x:-10,z:10});match.startCombat();return match;
}
const snapshot=(match,ack=0)=>structuredClone({...match.snapshot(),inputAcks:{player:ack}});
function samePosition(a,b){for(const key of ['x','y','z','vy'])assert.ok(Math.abs(a[key]-b[key])<1e-9,`${key}: ${a[key]} vs ${b[key]}`);}

test('movement responds before a server reply and replays only unacknowledged commands',()=>{
  const match=fixture(),net=new NetworkMovement('player');let state=snapshot(match);net.receive(state,0);
  for(let n=0;n<6;n++)net.step({forward:1,yaw:-Math.PI/2},state);
  assert.ok(net.predicted.x>match.actors[0].x+.3,'local movement requires no round trip');
  const expected={...net.predicted},frames=net.takeInputs();
  for(const frame of frames.slice(0,3)){match.setInput('player',frame.input);match.step(SIMULATION_STEP);}
  state=snapshot(match,3);net.receive(state,100);
  assert.deepEqual(net.pending.map(f=>f.sequence),[4,5,6]);samePosition(net.predicted,expected);
  const rendered=net.render(state,100,SIMULATION_STEP).actors[0];samePosition(rendered,expected);
});

test('prediction stays aligned under delayed batched inputs and delayed snapshots',()=>{
  const match=fixture(),reference=fixture(),net=new NetworkMovement('player'),queue=new InputQueue();
  let state=snapshot(match);net.receive(state,0);const packets=[],snapshots=[];
  for(let tick=1;tick<=180;tick++){
    // Includes jump holding, landing, release/rejump, crouch, aim and weapon speed changes.
    const input={forward:tick<100?1:0,strafe:tick>40&&tick<80?1:0,yaw:-Math.PI/2,
      jump:tick<60||tick>90&&tick<100,crouch:tick>110&&tick<130,aim:tick>130,
      sprint:tick>25&&tick<40,weapon:tick===70?'lmg':null};
    net.step(input,state);reference.setInput('player',input);reference.step(SIMULATION_STEP);
    if(tick%2===0)packets.push({at:tick+6,frames:net.takeInputs()});
    while(packets[0]?.at<=tick)queue.push(packets.shift().frames);
    const frame=queue.next();match.actors[0].waitingForInput=!frame;
    if(frame)match.setInput('player',frame.input);match.step(SIMULATION_STEP);
    if(tick%3===0)snapshots.push({at:tick+6,state:snapshot(match,queue.ack)});
    while(snapshots[0]?.at<=tick){state=snapshots.shift().state;net.receive(state,tick*1000/60);}
    samePosition(net.predicted,reference.actors[0]);
  }
});

test('400ms input burst preserves held left movement and the final stop',()=>{
  const server=fixture(),reference=fixture(),net=new NetworkMovement('player'),queue=new InputQueue(),packets=[];
  let state=snapshot(server);net.receive(state,0);
  for(let tick=1;tick<=68;tick++){
    if(tick<=44){
      const input={strafe:tick<=40?-1:0,yaw:0};
      net.step(input,state);reference.setInput('player',input);reference.step(SIMULATION_STEP);
      packets.push(net.takeInputs());
    }
    if(tick<5||tick>=28)while(packets.length)queue.push(packets.shift());
    const frame=queue.next();server.actors[0].waitingForInput=!frame;
    if(frame)server.setInput('player',frame.input);
    server.step(SIMULATION_STEP);
    if(tick%3===0){state=snapshot(server,queue.ack);net.receive(state,tick*1000/60);}
    samePosition(net.predicted,reference.actors[0]);
  }
  assert.equal(queue.ack,44);samePosition(server.actors[0],reference.actors[0]);
});

test('server correction preserves continuity, converges and resets on death and new rounds',()=>{
  const match=fixture(),net=new NetworkMovement('player');let state=snapshot(match);net.receive(state,0);
  net.step({forward:1,yaw:-Math.PI/2},state);
  let before=net.render(state,16,0).actors[0].x;
  match.actors[0].x-=.5;state=snapshot(match);net.receive(state,50);
  assert.equal(net.render(state,50,0).actors[0].x,before,'small corrections do not snap the camera');
  const corrected=net.render(state,1050,1).actors[0];assert.ok(Math.abs(corrected.x-net.predicted.x)<1e-6);
  match.actors[0].alive=false;state=snapshot(match);net.receive(state,1100);
  assert.equal(net.pending.length,0);assert.equal(net.render(state,1100,0).actors[0].alive,false);
  match.round++;match.resetRound();state=snapshot(match);net.receive(state,1200);
  samePosition(net.render(state,1200,0).actors[0],match.actors[0]);
});

test('remote actors interpolate by simulation time, including yaw wrap, and skip teleports',()=>{
  const match=fixture(),net=new NetworkMovement('player'),first=snapshot(match);
  first.actors[1].yaw=Math.PI-.1;net.receive(first,1000);
  const second=structuredClone(first);second.time+=.05;second.actors[1].x+=.2;second.actors[1].yaw=-Math.PI+.1;net.receive(second,1050);
  const middle=net.render(second,1125,0).actors[1];
  assert.ok(Math.abs(middle.x-(first.actors[1].x+.1))<1e-9);assert.ok(Math.abs(middle.yaw-Math.PI)<1e-9);
  const teleported=structuredClone(second);teleported.time+=.05;teleported.actors[1].x+=8;net.receive(teleported,1100);
  assert.equal(net.render(teleported,1175,0).actors[1].x,teleported.actors[1].x);
});

test('input queue rejects duplicates and malformed sequences and bounds a client backlog',()=>{
  const queue=new InputQueue();
  queue.push([{sequence:1,input:{forward:100,x:999,hp:999}},{sequence:1,input:{}},{sequence:NaN,input:{}},{sequence:2,input:null}]);
  assert.equal(queue.frames.length,1);assert.equal(queue.next().input.forward,1);assert.equal(queue.ack,1);
  for(let sequence=2;sequence<=50;sequence++)queue.push([{sequence,input:{}}]);
  assert.equal(queue.frames.length,36);assert.equal(queue.next().sequence,15);
  queue.discard();assert.equal(queue.ack,50);assert.equal(queue.next(),undefined);
});

test('high refresh rendering moves between simulation steps without changing prediction history',()=>{
  const match=fixture(),net=new NetworkMovement('player'),state=snapshot(match),input={forward:1,yaw:-Math.PI/2};
  net.receive(state,0);let remainder=0,previous=match.actors[0].x;
  for(let frame=1;frame<=144;frame++){
    remainder+=1/144;
    while(remainder+1e-9>=SIMULATION_STEP){net.step(input,state);remainder-=SIMULATION_STEP;}
    const fixedPosition={...net.predicted};
    const rendered=net.render(state,frame*1000/144,1/144,{input,remainder}).actors[0];
    assert.ok(Math.abs(rendered.x-previous-3.5/144)<1e-9,'every displayed frame advances instead of holding for a 60 Hz step');
    samePosition(net.predicted,fixedPosition);previous=rendered.x;
  }
});

test('render projection uses collision rules and cannot add movement beyond one simulation step',()=>{
  const match=fixture(),net=new NetworkMovement('player'),state=snapshot(match),input={forward:1,yaw:-Math.PI/2};
  net.receive(state,0);const before={...net.predicted};
  const rendered=net.render(state,0,0,{input,remainder:10}).actors[0];
  assert.ok(Math.abs(rendered.x-before.x-3.5/60)<1e-9);samePosition(net.predicted,before);
});

test('a tap between simulation ticks keeps its press direction through transport and fires once',()=>{
  const match=fixture(),net=new NetworkMovement('player'),queue=new InputQueue(),trigger=new TriggerInput();
  const state=snapshot(match),current={yaw:0,pitch:0,forward:1,fire:false};net.receive(state,0);
  const actor=match.actors[0];actor.weapon='dmr';actor.lastInput={fire:true};
  trigger.press(-Math.PI/2,.05);trigger.release();
  net.step(trigger.sample(current),state);queue.push(net.takeInputs());
  const {input}=queue.next();assert.deepEqual(input.firePose,{yaw:-Math.PI/2,pitch:.05});
  match.setInput('player',input);match.step(SIMULATION_STEP);
  assert.equal(actor.yaw,current.yaw);assert.equal(actor.x,state.actors[0].x);assert.ok(actor.z<state.actors[0].z);
  const shot=match.events.find(e=>e.type==='shot');assert.ok(shot);
  const end=shot.traces[0].end;assert.ok(end.x-shot.origin.x>Math.abs(end.z-shot.origin.z),'shot points toward the click, not the later camera');
  actor.cooldown=0;match.step(SIMULATION_STEP);
  assert.equal(match.events.filter(e=>e.type==='shot').length,1,'reused input must not repeat a semi-auto press');
  assert.equal(trigger.sample(current),current);
});

test('corrections just over the smoothing limit do not become full camera snaps',()=>{
  const match=fixture(),net=new NetworkMovement('player'),first=snapshot(match);net.receive(first,0);
  match.actors[0].x+=2.1;match.time+=.05;
  const next=snapshot(match);net.receive(next,50);
  assert.ok(Math.abs(net.render(next,50,0).actors[0].x-first.actors[0].x-.1)<1e-9);
  assert.ok(Math.abs(net.render(next,1050,1).actors[0].x-next.actors[0].x)<1e-6);
});

test('remote shots play once at the interpolated aim time, including while spectating',()=>{
  const match=fixture(),net=new NetworkMovement('player'),first=snapshot(match);first.actors[1].yaw=0;net.receive(first,1000);
  const second=structuredClone(first);second.time+=.06;second.actors[0].alive=false;second.actors[1].yaw=.6;
  net.receive(second,1120);
  const shot={id:10,type:'shot',actor:'enemy',time:.03};net.queueRemoteShot(shot);
  assert.deepEqual(net.takeRemoteShots(1120),[]);
  assert.ok(Math.abs(net.render(second,1131,0).actors[1].yaw-.31)<1e-9);
  assert.deepEqual(net.takeRemoteShots(1131),[shot]);
  assert.deepEqual(net.takeRemoteShots(1160),[]);
  net.queueRemoteShot({...shot,id:11,time:.06});
  const next=structuredClone(second);next.round++;next.time+=.05;net.receive(next,1170);
  assert.deepEqual(net.takeRemoteShots(1400),[],'queued effects do not spill into the next round');
});

test('fixed clock catches up late timer callbacks without running an unbounded stall',()=>{
  const clock=new FixedClock(0);let steps=0;
  for(const now of [16,49,101,155,250,499,749,999,1000])clock.advance(now,()=>steps++);
  assert.equal(steps,60);assert.equal(clock.advance(1000,()=>steps++),0);
  assert.equal(clock.advance(10000,()=>steps++),15);assert.equal(steps,75);
});
