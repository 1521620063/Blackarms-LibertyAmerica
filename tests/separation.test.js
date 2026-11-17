import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createFrontendServer } from '../frontend/server.mjs';
import { startBackend as createBackend } from '../scripts/rust-backend.mjs';
import { readFile, readdir } from 'node:fs/promises';
import * as gameData from '../frontend/src/game/data.js';
import { createServer as createApp } from './app.mjs';
import { roomServerUrl } from '../frontend/src/connection.js';

test('public mode enforces its configured frontend Origin even for matching Host',async()=>{
  const app=await createBackend({port:0,mode:'public',allowedOrigins:['https://game.example']});let allowed,denied;
  try{
    allowed=connect(app.url,'https://game.example');assert.equal((await allowed.hello).type,'hello');
    denied=new WebSocket(app.url.replace('http:','ws:')+'/lan',{origin:app.url});
    await new Promise((resolve,reject)=>{denied.once('error',resolve);denied.once('open',()=>reject(new Error('Public server accepted an unconfigured Origin')));});
  }finally{allowed?.ws.terminate();denied?.terminate();await app.close();}
});

test('frontend proxy preserves browser Origin in public mode and rejects unconfigured origins',async()=>{
  const backend=await createBackend({port:0,mode:'public',allowedOrigins:['https://game.example:443']});
  let frontend,allowed,denied;
  try{
    frontend=await createFrontendServer({port:0,host:'127.0.0.1',backendUrl:backend.url,tls:false});
    const base=address(frontend.server);
    allowed=connect(base,'https://game.example');
    assert.equal((await allowed.hello).type,'hello');
    denied=new WebSocket(base.replace('http:','ws:')+'/lan',{origin:'https://untrusted.example'});
    await new Promise((resolve,reject)=>{denied.once('error',resolve);denied.once('open',()=>reject(new Error('Proxy bypassed the Origin allowlist')));});
  }finally{allowed?.ws.terminate();denied?.terminate();await frontend?.close();await backend.close();}
});

test('frontend modules have no backend imports and Rust embeds matching protocol data',async()=>{
  const root=new URL('../frontend/',import.meta.url);
  for(const file of await readdir(new URL('src/',root),{recursive:true}))if(file.endsWith('.js')){
    const source=await readFile(new URL('src/'+file.replaceAll('\\','/'),root),'utf8');
    assert.doesNotMatch(source,/backend\//,file);
  }
  const rustData=JSON.parse(await readFile(new URL('../backend/src/game-data.json',import.meta.url),'utf8'));
  const expected=Object.fromEntries(Object.entries(gameData).filter(([,v])=>typeof v!=='function'));
  assert.deepEqual(rustData,expected,'update both independent data copies when changing game rules');
});

const address=server=>`http://127.0.0.1:${server.address().port}`;
function connect(url,origin){
  const ws=new WebSocket(url.replace('http:','ws:')+'/lan',{origin});
  const hello=once(ws,'message').then(([raw])=>JSON.parse(raw));
  return {ws,hello};
}

test('frontend connection URLs support proxy paths and independent HTTP/HTTPS backends',()=>{
  assert.equal(roomServerUrl('', 'http://localhost:5173/'), 'ws://localhost:5173/lan');
  assert.equal(roomServerUrl('', 'https://game.example/play/'), 'wss://game.example/lan');
  assert.equal(roomServerUrl('http://localhost:3000', 'http://localhost:5173/'), 'ws://localhost:3000/lan');
  assert.equal(roomServerUrl('https://api.example', 'https://game.example/'), 'wss://api.example/lan');
  assert.equal(roomServerUrl('wss://api.example/game/lan', 'https://game.example/'), 'wss://api.example/game/lan');
  assert.throws(()=>roomServerUrl('http://api.example','https://game.example/'),/HTTPS/);
  assert.throws(()=>roomServerUrl('file:///tmp/socket','http://localhost:5173/'),/后台地址/);
});

test('backend serves health independently, accepts configured frontend origins and rejects others',async()=>{
  const app=await createBackend({host:'127.0.0.1',port:0,allowedOrigins:['https://game.example']});
  let client,denied;
  try{
    const base=address(app.server),health=await fetch(base+'/health');
    assert.deepEqual(await health.json(),{status:'ok',rooms:0});
    for(const path of ['/','/index.html','/src/main.js','/art/manifest.json'])assert.equal((await fetch(base+path)).status,404);
    client=connect(base,'https://game.example');assert.equal((await client.hello).type,'hello');
    denied=new WebSocket(base.replace('http:','ws:')+'/lan',{origin:'https://other.example'});
    await new Promise((resolve,reject)=>{denied.once('error',resolve);denied.once('open',()=>reject(new Error('Unconfigured cross-origin connection was accepted')));});
  }finally{client?.ws.terminate();denied?.terminate();await app.close();}
});

test('separate frontend and backend ports serve the page and proxy real room traffic',async()=>{
  const app=await createApp();let client;
  try{
    assert.notEqual(app.server.address().port,app.backend.address().port);
    const base=address(app.server),page=await fetch(base);
    assert.equal(page.status,200);assert.match(await page.text(),/id="start-offline"/);
    assert.equal((await fetch(base+'/src/main.js')).status,200);
    client=connect(base,base);assert.equal((await client.hello).type,'hello');
    const lobby=once(client.ws,'message').then(([raw])=>JSON.parse(raw));
    client.ws.send(JSON.stringify({type:'create',name:'Split deployment',config:{teamSize:1}}));
    const message=await lobby;assert.equal(message.type,'lobby');assert.equal((await (await fetch(app.backendUrl+'/health')).json()).rooms,1);
  }finally{client?.ws.terminate();await app.close();}
});
