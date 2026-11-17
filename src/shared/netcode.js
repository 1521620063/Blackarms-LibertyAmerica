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
    if(this.frames.length>12)this.frames.splice(0,this.frames.length-12);
  }
  next(){const frame=this.frames.shift();if(frame)this.ack=frame.sequence;return frame;}
  discard(){this.frames=[];this.ack=this.received;}
}

const poseKeys=['x','y','z','yaw','pitch','aim','crouch','sprinting'];
const generation=state=>`${state.session}:${state.round}:${state.phase}`;
const simulate=(actor,input)=>{if(input.weapon)actor.weapon=input.weapon;moveActor(actor,input,SIMULATION_STEP);};

export class NetworkMovement {
  constructor(playerId){
    this.playerId=playerId;this.sequence=0;this.pending=[];this.outbox=[];this.samples=[];
    this.predicted=null;this.offset={x:0,y:0,z:0};this.key=null;this.clockOffset=null;
  }
  receive(state,now){
    const actor=state.actors.find(a=>a.id===this.playerId),key=generation(state);
    const reset=this.key!==key||!actor?.alive||!this.predicted?.alive;
    const previous=this.predicted&&{x:this.predicted.x+this.offset.x,y:this.predicted.y+this.offset.y,z:this.predicted.z+this.offset.z};
    if(reset){this.pending=[];this.outbox=[];this.samples=[];this.clockOffset=null;}
    this.key=key;
    this.pending=this.pending.filter(frame=>frame.sequence>(state.inputAcks?.[this.playerId]??0));
    this.predicted=actor?{...actor}:null;
    if(actor?.alive&&state.phase==='combat')for(const frame of this.pending)simulate(this.predicted,frame.input);
    const error=previous&&actor?Math.hypot(previous.x-this.predicted.x,previous.y-this.predicted.y,previous.z-this.predicted.z):Infinity;
    for(const axis of ['x','y','z'])this.offset[axis]=!reset&&error<2?previous[axis]-this.predicted[axis]:0;
    const offset=now-state.time*1000;
    this.clockOffset=this.clockOffset===null?offset:Math.min(this.clockOffset,offset);
    this.samples.push(state);if(this.samples.length>20)this.samples.shift();
  }
  step(rawInput,state){
    const input=sanitizeInput(rawInput),frame={sequence:++this.sequence,input};
    this.pending.push(frame);this.outbox.push(frame);
    if(this.pending.length>120)this.pending.shift();
    if(this.outbox.length>120)this.outbox.shift();
    if(this.predicted?.alive&&state.phase==='combat')simulate(this.predicted,input);
  }
  takeInputs(){return this.outbox.splice(0,6);}
  render(state,now,dt){
    const decay=Math.exp(-dt*18);for(const axis of ['x','y','z'])this.offset[axis]*=decay;
    const target=(now-this.clockOffset)/1000-.1;
    let before=this.samples[0]||state,after=before;
    for(const sample of this.samples){after=sample;if(sample.time>=target)break;before=sample;}
    const alpha=after.time>before.time?Math.max(0,Math.min(1,(target-before.time)/(after.time-before.time))):1;
    const previousActors=new Map(before.actors.map(a=>[a.id,a])),nextActors=new Map(after.actors.map(a=>[a.id,a]));
    return {...state,actors:state.actors.map(actor=>{
      if(actor.id===this.playerId){
        if(!actor.alive||state.phase!=='combat'||!this.predicted)return actor;
        const result={...actor};for(const key of poseKeys)result[key]=this.predicted[key];
        for(const axis of ['x','y','z'])result[axis]+=this.offset[axis];
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
