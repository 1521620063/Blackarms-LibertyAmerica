import { sanitizeInput } from './match.js';
import { moveActor, SIMULATION_STEP } from './movement.js';

export class InputQueue {
  constructor(){this.frames=[];this.received=0;this.ack=0;this.enabled=false;}
  push(frames){
    if(!Array.isArray(frames)||frames.length>6)return;
    for(const frame of frames){
      if(!frame||!Number.isSafeInteger(frame.sequence)||frame.sequence<=this.received||!frame.input||typeof frame.input!=='object')continue;
      this.enabled=true;this.received=frame.sequence;
      this.frames.push({sequence:frame.sequence,input:sanitizeInput(frame.input)});
    }
    // Bound latency and memory; discarded commands are corrected by the next snapshot.
    const maxQueuedInputs=36; // Match the Rust server's 600 ms jitter budget.
    if(this.frames.length>maxQueuedInputs)this.frames.splice(0,this.frames.length-maxQueuedInputs);
  }
  next(){const frame=this.frames.shift();if(frame)this.ack=frame.sequence;return frame;}
  discard(){this.frames=[];this.ack=this.received;}
}

const poseKeys=['x','y','z','yaw','pitch','aim','crouch','sprinting'];
const axes=['x','y','z'];
const generation=state=>`${state.session}:${state.round}`;
const simulate=(actor,input)=>{if(input.weapon)actor.weapon=input.weapon;moveActor(actor,input,SIMULATION_STEP);};

export class TriggerInput {
  constructor(){this.clear();}
  press(yaw,pitch){if(!this.held)this.pressPose??={yaw,pitch};this.held=true;}
  release(){this.held=false;}
  clear(){this.held=false;this.pressPose=null;}
  sample(input){
    const press=this.pressPose;this.pressPose=null;
    return press?{...input,fire:true,firePose:press}:input;
  }
}

export class NetworkMovement {
  constructor(playerId){
    this.playerId=playerId;this.sequence=0;this.pending=[];this.outbox=[];this.samples=[];
    this.predicted=null;this.offset={x:0,y:0,z:0};this.key=null;this.phase=null;this.clockOffset=null;
    this.playhead=-Infinity;this.remoteShots=[];this.replayFloor=0;
  }
  receive(state,now){
    const actor=state.actors.find(a=>a.id===this.playerId),key=generation(state);
    const newRound=this.key!==key;
    const reset=newRound||this.phase!==state.phase||actor?.alive!==this.predicted?.alive;
    const previous=this.predicted&&{x:this.predicted.x+this.offset.x,y:this.predicted.y+this.offset.y,z:this.predicted.z+this.offset.z};
    if(reset){this.pending=[];this.outbox=[];this.replayFloor=0;}
    if(newRound){this.samples=[];this.clockOffset=null;this.playhead=-Infinity;this.remoteShots=[];}
    this.key=key;this.phase=state.phase;
    const ack=state.inputAcks?.[this.playerId]??0;
    this.pending=this.pending.filter(frame=>frame.sequence>ack);
    // An older ack needs inputs we have already evicted. Keep predicting until
    // replay is complete again, but continue accepting remote state and events.
    if(reset||!actor?.alive||state.phase!=='combat'||ack>=this.replayFloor){
      this.predicted=actor?{...actor}:null;
      if(actor?.alive&&state.phase==='combat')for(const frame of this.pending)simulate(this.predicted,frame.input);
      const error=previous&&actor?Math.hypot(previous.x-this.predicted.x,previous.y-this.predicted.y,previous.z-this.predicted.z):Infinity;
      // Limit the visual offset without turning a slightly larger correction into a full snap.
      const scale=!reset&&previous&&actor?Math.min(1,2/Math.max(error,1e-9)):0;
      for(const axis of axes)this.offset[axis]=scale?(previous[axis]-this.predicted[axis])*scale:0;
    }
    const offset=now-state.time*1000;
    this.clockOffset=this.clockOffset===null?offset:Math.min(this.clockOffset,offset);
    this.samples.push(state);if(this.samples.length>20)this.samples.shift();
  }
  step(rawInput,state){
    const input=sanitizeInput(rawInput),frame={sequence:++this.sequence,input};
    this.pending.push(frame);this.outbox.push(frame);
    if(this.pending.length>120)this.replayFloor=this.pending.shift().sequence;
    if(this.outbox.length>120)this.outbox.shift();
    if(this.predicted?.alive&&state.phase==='combat')simulate(this.predicted,input);
  }
  takeInputs(){return this.outbox.splice(0,6);}
  queueRemoteShot(event){this.remoteShots.push(event);if(this.remoteShots.length>128)this.remoteShots.shift();}
  playbackTime(now){
    const latest=this.samples.at(-1)?.time??-Infinity;
    const target=Math.min(latest,(now-this.clockOffset)/1000-.1);
    this.playhead=Math.max(this.playhead,target);
    return this.playhead;
  }
  takeRemoteShots(now){
    const target=this.playbackTime(now),next=this.remoteShots.findIndex(event=>event.time>target);
    return this.remoteShots.splice(0,next<0?this.remoteShots.length:next);
  }
  render(state,now,dt,{input=null,remainder=0}={}){
    // Project only the displayed pose between fixed simulation ticks. Prediction history
    // and server reconciliation remain on the exact same 60 Hz movement steps.
    let local=this.predicted;
    if(local?.alive&&state.phase==='combat'&&input&&remainder>0){
      local={...local};const movement=sanitizeInput(input);if(movement.weapon)local.weapon=movement.weapon;
      moveActor(local,movement,SIMULATION_STEP);
      const fraction=Math.min(1,remainder/SIMULATION_STEP);
      for(const axis of axes)local[axis]=this.predicted[axis]+(local[axis]-this.predicted[axis])*fraction;
    }
    const decay=Math.exp(-dt*18);for(const axis of axes)this.offset[axis]*=decay;
    const target=this.playbackTime(now);
    let before=this.samples[0]||state,after=before;
    for(const sample of this.samples){after=sample;if(sample.time>=target)break;before=sample;}
    const alpha=after.time>before.time?Math.max(0,Math.min(1,(target-before.time)/(after.time-before.time))):1;
    const previousActors=new Map(before.actors.map(a=>[a.id,a])),nextActors=new Map(after.actors.map(a=>[a.id,a]));
    return {...state,actors:state.actors.map(actor=>{
      if(actor.id===this.playerId){
        if(!actor.alive||state.phase!=='combat'||!local)return actor;
        const result={...actor};for(const key of poseKeys)result[key]=local[key];
        for(const axis of axes)result[axis]+=this.offset[axis];
        return result;
      }
      const a=previousActors.get(actor.id),b=nextActors.get(actor.id);
      if(!a||!b||!a.alive||!b.alive||!actor.alive||Math.hypot(b.x-a.x,b.z-a.z)>4)return actor;
      const result={...actor};for(const axis of ['x','y','z','pitch'])result[axis]=a[axis]+(b[axis]-a[axis])*alpha;
      result.yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*alpha;
      return result;
    })};
  }
}
