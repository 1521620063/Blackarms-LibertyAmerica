import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { Match } from '../src/shared/match.js';

const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<1e6)ws.send(JSON.stringify(data));};
export function attachLAN(server) {
  const rooms=new Map(),peers=new Map();
  const wss=new WebSocketServer({noServer:true,maxPayload:4096});
  server.on('upgrade',(request,socket,head)=>{
    if(request.url!=='/lan')return;
    try {if(new URL(request.headers.origin).host!==request.headers.host){socket.destroy();return;}} catch {socket.destroy();return;}
    wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,request));
  });
  const roster=room=>({type:'lobby',code:room.code,host:room.host,config:room.config,players:[...room.members.values()].map(({id,name,squad,primary,armor})=>({id,name,squad,primary,armor})),started:!!room.match});
  const broadcast=(room,data)=>{for(const p of room.members.values())send(p.ws,data);};
  function leave(peer) {
    const room=rooms.get(peer.code);peer.code=null;
    if(!room)return;
    room.members.delete(peer.id);
    if(room.match) {const a=room.match.actors.find(a=>a.id===peer.id);if(a){a.bot=true;a.input={};a.name=`${peer.name} / AI`;}}
    if(!room.members.size){rooms.delete(room.code);return;}
    if(room.host===peer.id)room.host=room.members.keys().next().value;
    broadcast(room,roster(room));
  }
  wss.on('connection',ws=>{
    const peer={id:randomBytes(6).toString('hex'),ws,code:null,name:'先锋',squad:0,last:Date.now(),window:Date.now(),messages:0};peers.set(ws,peer);send(ws,{type:'hello',id:peer.id});
    ws.on('message',raw=>{
      if(Date.now()-peer.window>1000){peer.window=Date.now();peer.messages=0;}
      if(++peer.messages>100)return;
      try {
        const msg=JSON.parse(raw.toString());peer.last=Date.now();
        let room=rooms.get(peer.code);
        if(msg.type==='ping'){send(ws,{type:'pong',sent:msg.sent});return;}
        if(msg.type==='leave'){leave(peer);return;}
        if(msg.type==='create') {
          if(rooms.size>=100)throw new Error('房间数量已满');leave(peer);
          const config=new Match(msg.config).config;
          room={code:randomBytes(3).toString('hex').toUpperCase(),host:peer.id,config,members:new Map(),match:null};rooms.set(room.code,room);
        } else if(msg.type==='join') {
          if(room)leave(peer);room=rooms.get(String(msg.code).trim().toUpperCase());
          if(!room)throw new Error('房间不存在，请检查房间码和服务器地址');
          if(room.match)throw new Error('比赛已开始，请等待本场比赛结束');
          if(room.members.size>=room.config.teamSize*2)throw new Error('房间已满');
        }
        if(['create','join'].includes(msg.type)) {
          peer.code=room.code;peer.name=String(msg.name||'先锋').replace(/[<>\x00-\x1f]/g,'').slice(0,18);
          const count=s=>[...room.members.values()].filter(p=>p.squad===s).length;
          peer.squad=count(0)<=count(1)?0:1;peer.primary=room.config.primary;peer.armor=room.config.armor;
          room.members.set(peer.id,peer);broadcast(room,roster(room));return;
        }
        if(!room)throw new Error('请先创建或加入房间');
        if(msg.type==='team'&&!room.match) {
          const squad=msg.squad===1?1:0;
          if([...room.members.values()].filter(p=>p.squad===squad&&p.id!==peer.id).length>=room.config.teamSize)throw new Error('该队伍已满');
          peer.squad=squad;broadcast(room,roster(room));
        } else if(msg.type==='start') {
          if(room.host!==peer.id)throw new Error('只有房主可以开始比赛');
          if(room.match&&room.match.phase!=='matchResult')throw new Error('比赛正在进行');
          room.match=new Match(room.config,[...room.members.values()]);
          broadcast(room,{type:'started',state:room.match.snapshot()});
        } else if(msg.type==='input'&&room.match)room.match.setInput(peer.id,msg.input);
        else if(msg.type==='loadout') {
          const primary=msg.primary==='scatter'?'scatter':'rifle',armor=msg.armor==='heavy'?'heavy':'light';
          peer.primary=primary;peer.armor=armor;room.match?.setLoadout(peer.id,primary,armor);
        }
      }catch(error){send(ws,{type:'error',message:error.message});}
    });
    ws.on('close',()=>{leave(peer);peers.delete(ws);});ws.on('error',()=>ws.close());
  });
  let ticks=0;
  const timer=setInterval(()=>{
    ticks++;
    for(const peer of peers.values()) {
      if(Date.now()-peer.last>30000){peer.ws.terminate();continue;}
      if(Date.now()-peer.last>1200)rooms.get(peer.code)?.match?.setInput(peer.id,{});
    }
    for(const room of rooms.values())if(room.match){room.match.step(1/60);if(ticks%3===0)broadcast(room,{type:'state',state:room.match.snapshot()});}
  },1000/60);timer.unref();
  const close=()=>{clearInterval(timer);for(const ws of peers.keys())ws.terminate();wss.close();};
  server.on('close',close);
  return {rooms,close};
}
export async function createServer({production=false,port=5173,host='0.0.0.0'}={}) {
  let vite=null;
  const root=resolve('dist');
  if(production&&!existsSync(resolve(root,'index.html')))throw new Error('请先运行 npm run build');
  const server=http.createServer((req,res)=>{
    if(vite){vite.middlewares(req,res,()=>{res.writeHead(404);res.end('Not found');});return;}
    try {
      const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
      if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
      const file=path===root?resolve(root,'index.html'):path;
      if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});createReadStream(file).pipe(res);
    }catch{res.writeHead(400);res.end();}
  });
  if(!production){const {createServer:createVite}=await import('vite');vite=await createVite({server:{middlewareMode:true,hmr:{server}},appType:'spa'});}
  const lan=attachLAN(server);
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,host,ok);});
  return {server,lan,vite,async close(){lan.close();await vite?.close();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const port=Number(process.env.PORT)||5173;
  createServer({production:process.argv.includes('--production'),port}).then(()=>{
    console.log(`Blackarms Liberty America → http://localhost:${port}`);
    for(const list of Object.values(networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal)console.log(`LAN → http://${n.address}:${port}`);
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
