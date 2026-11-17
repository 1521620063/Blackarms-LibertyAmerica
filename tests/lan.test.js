import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startBackend } from '../scripts/rust-backend.mjs';

export function client(address){
  const ws=new WebSocket(address.replace('http:','ws:')+'/lan',{origin:address}),log=[],pending=new Set();
  ws.on('message',data=>{const m=JSON.parse(data);log.push(m);for(const item of pending)if(item.predicate(m)){pending.delete(item);clearTimeout(item.timer);item.resolve(m);}});
  return {ws,log,send:m=>ws.send(JSON.stringify(m)),wait(predicate){const found=log.find(predicate);if(found)return Promise.resolve(found);return new Promise((resolve,reject)=>{const item={predicate,resolve,timer:setTimeout(()=>{pending.delete(item);reject(new Error('Timed out waiting for websocket message'));},10000)};pending.add(item);});}};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,100));
test('Rust WebSockets: host authority, roster, loadouts, inputs, bot takeover and cleanup',async()=>{
  const app=await startBackend({port:0}),a=client(app.url),b=client(app.url);
  try{
    const ah=await a.wait(m=>m.type==='hello'),bh=await b.wait(m=>m.type==='hello');
    a.send({type:'create',name:'Host',config:{mode:'core',teamSize:2}});const created=await a.wait(m=>m.type==='lobby');
    assert.match(created.code,/^[A-F0-9]{6}$/);b.send({type:'join',code:created.code,name:'Guest'});
    const joined=await b.wait(m=>m.type==='lobby'&&m.players.length===2);assert.equal(joined.host,ah.id);
    b.send({type:'start'});assert.match((await b.wait(m=>m.type==='error')).message,/只有房主/);
    b.send({type:'loadout',primary:'scatter',armor:'heavy'});await b.wait(m=>m.type==='lobby'&&m.players.some(p=>p.id===bh.id&&p.primary==='scatter'));
    a.send({type:'start'});const started=await a.wait(m=>m.type==='started');await b.wait(m=>m.type==='started');
    assert.equal(started.state.actors.length,4);assert.equal(started.state.actors.filter(p=>!p.bot).length,2);
    assert.equal(started.state.actors.find(p=>p.id===bh.id).primary,'scatter');
    for(const primary of ['smg','dmr','lmg','sniper']){
      b.send({type:'loadout',primary,armor:'heavy'});
      const state=(await b.wait(m=>m.type==='state'&&m.state.actors.some(p=>p.id===bh.id&&p.weapon===primary))).state;
      assert.equal(state.actors.find(p=>p.id===bh.id).primary,primary);
    }
    a.send({type:'input',input:{ready:true,yaw:-Math.PI/2}});b.send({type:'input',input:{ready:true}});
    const combat=(await a.wait(m=>m.type==='state'&&m.state.phase==='combat')).state;
    const before=combat.actors.find(p=>p.id===ah.id).x;
    a.send({type:'input',input:{forward:1,yaw:-Math.PI/2,x:999,hp:999,damage:999}});
    const moved=(await a.wait(m=>m.type==='state'&&m.state.actors.some(p=>p.id===ah.id&&p.x>before+.05))).state.actors.find(p=>p.id===ah.id);
    assert.ok(moved.x<16);assert.ok(moved.hp<=100);
    a.ws.close();await b.wait(m=>m.type==='lobby'&&m.host===bh.id&&m.players.length===1);
    const takeover=(await b.wait(m=>m.type==='state'&&m.state.actors.some(p=>p.id===ah.id&&p.bot))).state;
    assert.equal(takeover.actors.length,4);
    b.ws.close();await tick();assert.equal((await (await fetch(app.url+'/health')).json()).rooms,0);
  }finally{a.ws.terminate();b.ws.terminate();await app.close();}
});

test('Rust sequenced inputs acknowledge once and reject stale sessions and rounds',async()=>{
  const app=await startBackend({port:0}),a=client(app.url);
  try{
    const hello=await a.wait(m=>m.type==='hello');
    a.send({type:'create',config:{teamSize:1}});await a.wait(m=>m.type==='lobby');
    a.send({type:'start'});const started=await a.wait(m=>m.type==='started');
    a.send({type:'input',session:started.state.session,round:1,frames:[{sequence:1,input:{ready:true}}]});
    const combat=(await a.wait(m=>m.type==='state'&&m.state.phase==='combat')).state;
    const before=combat.actors.find(p=>p.id===hello.id).x;
    const frames=Array.from({length:6},(_,i)=>({sequence:i+2,input:{forward:1,yaw:-Math.PI/2,x:999,hp:999}}));
    a.send({type:'input',session:started.state.session,round:1,frames});
    const ack=(await a.wait(m=>m.type==='state'&&m.state.inputAcks[hello.id]===7)).state;
    const actor=ack.actors.find(p=>p.id===hello.id);assert.ok(Math.abs(actor.x-before-6*3.5/60)<1e-9);
    const time=ack.time;
    a.send({type:'input',session:started.state.session,round:1,frames});
    a.send({type:'input',session:'old-session',round:1,frames:[{sequence:999,input:{forward:1}}]});
    a.send({type:'input',session:started.state.session,round:2,frames:[{sequence:998,input:{forward:1}}]});
    const later=(await a.wait(m=>m.type==='state'&&m.state.time>time+.1)).state;
    assert.equal(later.inputAcks[hello.id],7);assert.equal(later.actors.find(p=>p.id===hello.id).x,actor.x);
    assert.ok(actor.hp<=100);assert.equal(actor.damage,0);
  }finally{a.ws.terminate();await app.close();}
});
