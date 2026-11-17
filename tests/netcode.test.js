import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/shared/match.js';
import { NetworkMovement, InputQueue } from '../src/shared/netcode.js';
import { FixedClock, SIMULATION_STEP } from '../src/shared/movement.js';

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
  for(let sequence=2;sequence<=30;sequence++)queue.push([{sequence,input:{}}]);
  assert.equal(queue.frames.length,12);assert.equal(queue.next().sequence,19);
  queue.discard();assert.equal(queue.ack,30);assert.equal(queue.next(),undefined);
});

test('fixed clock catches up late timer callbacks without running an unbounded stall',()=>{
  const clock=new FixedClock(0);let steps=0;
  for(const now of [16,49,101,155,250,499,749,999,1000])clock.advance(now,()=>steps++);
  assert.equal(steps,60);assert.equal(clock.advance(1000,()=>steps++),0);
  assert.equal(clock.advance(10000,()=>steps++),15);assert.equal(steps,75);
});
