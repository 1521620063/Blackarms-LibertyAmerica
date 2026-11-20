// Keep game metadata reliable while letting newer poses bypass delayed TCP data.
export class PoseSnapshots {
  reliable=null;
  pose=null;
  acceptReliable(state){
    this.reliable=state;
    if(this.pose&&!this.isNewerPose(this.pose))this.pose=null;
    return this.current();
  }
  isNewerPose(pose){
    const {session,round,phase,tick}=this.reliable??{};
    return pose.session===session&&pose.round===round&&pose.phase===phase&&pose.tick>tick;
  }
  acceptDatagram(packet,playerId){
    if(!Array.isArray(packet))return null;
    const [version,session,round,phase,tick,time,ack,rows]=packet;
    if(version!==1||!Number.isSafeInteger(tick)||!Number.isFinite(time)||
      !Number.isSafeInteger(ack)||ack<0||!Array.isArray(rows)||rows.length>10||tick<=(this.pose?.tick??-1))return null;
    const actors=new Map();
    for(const row of rows){
      if(!Array.isArray(row)||row.length!==10||!row.slice(1,8).every(Number.isFinite))return null;
      const [id,x,y,z,yaw,pitch,vy,flags,weapon,armor]=row;
      actors.set(id,{x,y,z,yaw,pitch,vy,alive:!!(flags&1),aim:!!(flags&2),crouch:!!(flags&4),
        sprinting:!!(flags&8),jumpHeld:!!(flags&16),weapon,armor});
    }
    const pose={session,round,phase,tick,time,ack,actors,playerId};
    if(!this.isNewerPose(pose)||this.reliable.actors.length!==actors.size||
      !this.reliable.actors.every(a=>actors.get(a.id)?.alive===a.alive))return null;
    this.pose=pose;
    return this.current();
  }
  current(){
    const state=this.reliable,pose=this.pose;
    if(!pose)return state;
    return {...state,tick:pose.tick,time:pose.time,inputAcks:{...state.inputAcks,[pose.playerId]:pose.ack},
      actors:state.actors.map(actor=>{
        const newer=pose.actors.get(actor.id);
        return newer?.alive===actor.alive?{...actor,...newer}:actor;
      })};
  }
}

export async function receivePoseDatagrams(socket, ticket, receive, signal){
  if(typeof WebTransport!=='function'||!socket.url.startsWith('wss:')||!ticket||signal.aborted)return;
  const url=new URL(socket.url);
  url.protocol='https:';
  url.pathname='/poses';
  url.search=new URLSearchParams({ticket}).toString();
  let transport;
  const close=()=>{try{transport?.close();}catch{}};
  signal.addEventListener('abort',close,{once:true});
  const timer=setTimeout(close,4000);
  try{
    transport=new WebTransport(url);
    transport.closed.catch(()=>{});
    await transport.ready;
    clearTimeout(timer);
    const reader=transport.datagrams.readable.getReader(),decoder=new TextDecoder();
    while(!signal.aborted){
      const {value,done}=await reader.read();
      if(done)break;
      try{receive(JSON.parse(decoder.decode(value)));}catch{}
    }
  }catch{
    // Browsers and networks without UDP continue receiving full WebSocket snapshots.
  }finally{
    clearTimeout(timer);
    close();
    signal.removeEventListener('abort',close);
  }
}
