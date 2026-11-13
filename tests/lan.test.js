import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { attachLAN } from '../server/index.js';

function client(address){
  const ws=new WebSocket(address.replace('http:','ws:')+'/lan',{origin:address});const log=[],pending=new Set();
  ws.on('message',data=>{const message=JSON.parse(data);log.push(message);for(const item of pending)if(item.predicate(message)){pending.delete(item);clearTimeout(item.timer);item.resolve(message);}});
  return {ws,log,send:m=>ws.send(JSON.stringify(m)),wait(predicate){const found=log.find(predicate);if(found)return Promise.resolve(found);return new Promise((resolve,reject)=>{const item={predicate,resolve,timer:setTimeout(()=>{pending.delete(item);reject(new Error('Timed out waiting for websocket message'));},4000)};pending.add(item);});}};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,80));
test('real WebSockets: room codes, host authority, roster, loadout, inputs, disconnect takeover and cleanup',async()=>{
  const server=http.createServer();const lan=attachLAN(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const address=`http://127.0.0.1:${server.address().port}`,a=client(address),b=client(address);
  try{
    const ah=await a.wait(m=>m.type==='hello'),bh=await b.wait(m=>m.type==='hello');
    a.send({type:'create',name:'Host',config:{mode:'core',teamSize:2}});const created=await a.wait(m=>m.type==='lobby');
    assert.match(created.code,/^[A-F0-9]{6}$/);b.send({type:'join',code:created.code,name:'Guest'});
    const joined=await b.wait(m=>m.type==='lobby'&&m.players.length===2);assert.equal(joined.host,ah.id);
    b.send({type:'start'});const error=await b.wait(m=>m.type==='error');assert.match(error.message,/只有房主/);
    b.send({type:'loadout',primary:'scatter',armor:'heavy'});a.send({type:'start'});
    const started=await a.wait(m=>m.type==='started');await b.wait(m=>m.type==='started');
    assert.equal(started.state.actors.length,4);assert.equal(started.state.actors.filter(p=>!p.bot).length,2);
    const room=lan.rooms.get(created.code),guest=room.match.actors.find(p=>p.id===bh.id);assert.equal(guest.primary,'scatter');
    for(const primary of ['smg','dmr','lmg','sniper']){
      b.send({type:'loadout',primary,armor:'heavy'});
      await b.wait(m=>m.type==='state'&&m.state.actors.some(p=>p.id===bh.id&&p.weapon===primary));
      assert.equal(guest.primary,primary);
    }
    a.send({type:'input',input:{ready:true,yaw:-Math.PI/2}});b.send({type:'input',input:{ready:true}});
    await a.wait(m=>m.type==='state'&&m.state.phase==='combat');
    b.send({type:'input',input:{weapon:'smg'}});
    await b.wait(m=>m.type==='state'&&m.state.phase==='combat'&&m.state.actors.some(p=>p.id===bh.id&&p.weapon==='smg'));
    assert.equal(guest.ammo.sniper.mag,5);assert.equal(guest.ammo.smg.mag,32);
    const host=room.match.actors.find(p=>p.id===ah.id),before=host.x;
    a.send({type:'input',input:{forward:1,yaw:-Math.PI/2,x:999,hp:999,damage:999}});await tick();
    assert.ok(host.x>before);assert.ok(host.x<16);assert.ok(host.hp<=100);
    a.ws.close();await b.wait(m=>m.type==='lobby'&&m.host===bh.id&&m.players.length===1);
    assert.equal(host.bot,true);assert.equal(room.match.actors.length,4);
    b.ws.close();await tick();assert.equal(lan.rooms.size,0);
  }finally{a.ws.terminate();b.ws.terminate();lan.close();await new Promise(r=>server.close(r));}
});
