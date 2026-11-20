import test from 'node:test';
import assert from 'node:assert/strict';
import { PoseSnapshots } from '../frontend/src/game/pose-transport.js';

const state=(overrides={})=>({session:'match',round:1,phase:'combat',tick:60,time:1,inputAcks:{me:8},actors:[{id:'me',x:1,alive:true,hp:100}],...overrides});
const packet=tick=>[1,'match',1,'combat',tick,tick/60,10,[['me',2,3,4,5,6,7,31,'rifle','light']]];

test('UDP poses and acknowledgments advance independently of reliable gameplay data',()=>{
  const snapshots=new PoseSnapshots();
  snapshots.acceptReliable(state());
  const next=snapshots.acceptDatagram(packet(63),'me');
  assert.equal(next.actors[0].x,2);
  assert.equal(next.actors[0].hp,100);
  assert.equal(next.actors[0].jumpHeld,true);
  assert.equal(next.inputAcks.me,10);
  assert.equal(snapshots.acceptDatagram(packet(62),'me'),null);
  assert.equal(snapshots.acceptDatagram(packet(63),'me'),null);
  const reliable=snapshots.acceptReliable(state({tick:61,events:[{id:1}],actors:[{id:'me',x:1,alive:true,hp:80}]}));
  assert.equal(reliable.tick,63);
  assert.equal(reliable.actors[0].x,2);
  assert.equal(reliable.actors[0].hp,80);
  assert.equal(reliable.events[0].id,1);
});

test('WebSocket covers dropped UDP poses and round changes reject obsolete packets',()=>{
  const snapshots=new PoseSnapshots();
  snapshots.acceptReliable(state());
  snapshots.acceptDatagram(packet(63),'me');
  assert.equal(snapshots.acceptReliable(state({tick:66})).actors[0].x,1);
  assert.equal(snapshots.acceptDatagram(packet(65),'me'),null);
  assert.equal(snapshots.acceptReliable(state({tick:68,round:2})).round,2);
  assert.equal(snapshots.acceptDatagram(packet(69),'me'),null);
  const unknown=packet(70);unknown[2]=2;unknown[7][0][0]='unknown';
  assert.equal(snapshots.acceptDatagram(unknown,'me'),null);
});

test('late reliable deaths preserve newer poses for surviving actors',()=>{
  const snapshots=new PoseSnapshots();
  const other={id:'other',alive:true,x:5};
  snapshots.acceptReliable(state({actors:[...state().actors,other]}));
  const sameRoster=packet(63);sameRoster[7].push(['other',6,3,4,5,6,7,1,'rifle','light']);
  assert.equal(snapshots.acceptDatagram(sameRoster,'me').tick,63);
  const next=snapshots.acceptReliable(state({tick:61,actors:[...state().actors,{...other,alive:false}]}));
  assert.equal(next.tick,63);
  assert.equal(next.actors[0].x,2);
  assert.equal(next.actors[1].alive,false);
  assert.equal(next.actors[1].x,5);
});
