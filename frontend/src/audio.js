import { WEAPONS, BOXES } from './game/data.js';
import { wallHit } from './game/geometry.js';
import { makeFoley, makeAmbience, FOLEY_NAMES } from './audio-synthesis.js';

// Layered, cached weapon reports. No network assets or runtime oscillators per shot.
const REPORTS={
  rifle:{duration:.62,punch:112,weight:.54,crack:.85,decay:.055,action:.078},
  scatter:{duration:.9,punch:69,weight:.95,crack:.68,decay:.105,action:.19},
  pistol:{duration:.44,punch:165,weight:.32,crack:.78,decay:.037,action:.065},
  smg:{duration:.36,punch:175,weight:.25,crack:.7,decay:.03,action:.055},
  dmr:{duration:.75,punch:95,weight:.7,crack:.96,decay:.075,action:.095},
  lmg:{duration:.7,punch:83,weight:.8,crack:.78,decay:.07,action:.09},
  sniper:{duration:1.35,punch:53,weight:1.15,crack:1.1,decay:.14,action:.41,returnDelay:.4}
};

export class AudioEngine {
  constructor(settings){this.settings=settings;this.ctx=null;this.noise=null;this.lastStep=0;this.lastBeep=0;this.reports={};this.reloadSounds=[];this.actorReloads=new Map();this.voices=new Set();this.walkers=new Map();this.listener=null;this.round=null;this.foley={};this.duckUntil=0;this.paused=false;}
  async prepare(){
    // AudioBuffers can be generated before a user gesture; create the live context
    // only in unlock(), so browser autoplay rules still apply.
    const ctx={sampleRate:48000,createBuffer:(channels,length,sampleRate)=>new AudioBuffer({numberOfChannels:channels,length,sampleRate})};
    for(const [type,profile] of Object.entries(REPORTS)){
      this.reports[type]=Array.from({length:5},()=>this.makeReport(profile,ctx));
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    for(const name of FOLEY_NAMES){
      this.foley[name]=Array.from({length:4},()=>makeFoley(ctx,name));
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    this.ambientBuffer=makeAmbience(ctx);
  }
  unlock(){
    if(!this.ctx){
      this.ctx=new AudioContext();this.setup();
    }
    this.master.gain.value=this.settings.volume*.7;this.ctx.resume().catch(()=>{});
  }
  setup(){
    const ctx=this.ctx;
    this.master=ctx.createGain();this.master.gain.value=this.settings.volume*.7;
    // Preserve the transient while keeping overlapping automatic fire under control.
    this.limiter=ctx.createDynamicsCompressor();this.limiter.threshold.value=-9;this.limiter.knee.value=8;
    this.limiter.ratio.value=5;this.limiter.attack.value=.002;this.limiter.release.value=.12;
    this.master.connect(this.limiter);this.limiter.connect(ctx.destination);
    this.worldBus=ctx.createGain();this.worldBus.connect(this.master);
    this.ambientGain=ctx.createGain();this.ambientGain.gain.value=0;this.ambientGain.connect(this.master);
    this.room=ctx.createConvolver();
    const impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*.38),ctx.sampleRate);
    for(let c=0;c<2;c++){
      const data=impulse.getChannelData(c);
      for(let i=0;i<data.length;i++){
        const t=i/ctx.sampleRate;
        data[i]=t<.022?0:(Math.random()*2-1)*Math.exp(-t*19)*.12;
      }
      for(const [time,amp] of [[.031,.32],[.063,.18],[.107,.09]])data[Math.floor((time+c*.002)*ctx.sampleRate)]+=amp;
    }
    this.room.buffer=impulse;const wet=ctx.createGain();wet.gain.value=.21;this.room.connect(wet);wet.connect(this.master);
    this.noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.4),ctx.sampleRate);
    const values=this.noise.getChannelData(0);for(let i=0;i<values.length;i++)values[i]=Math.random()*2-1;
    for(const [type,profile] of Object.entries(REPORTS))this.reports[type]??=Array.from({length:5},()=>this.makeReport(profile));
    for(const name of FOLEY_NAMES)this.foley[name]??=Array.from({length:4},()=>makeFoley(ctx,name));
    this.ambient=ctx.createBufferSource();this.ambient.buffer=this.ambientBuffer??=makeAmbience(ctx);this.ambient.loop=true;this.ambient.connect(this.ambientGain);this.ambient.start();
  }
  makeReport(p,ctx=this.ctx){
    const rate=ctx.sampleRate,buffer=ctx.createBuffer(1,Math.ceil(rate*p.duration),rate),data=buffer.getChannelData(0);
    const variation=.96+Math.random()*.08;
    let low=0,mid=0,air=0,phase=0,peak=0;
    for(let i=0;i<data.length;i++){
      const t=i/rate,n=Math.random()*2-1;
      low+=.045*(n-low);mid+=.34*(n-mid);air+=.72*(n-air);
      phase+=2*Math.PI*p.punch*variation*(.58+.64*Math.exp(-t*35))/rate;
      const attack=Math.min(1,t/.0007);
      const crack=(n-air)*p.crack*Math.exp(-t/.008);
      const blast=(mid-low)*1.8*Math.exp(-t/p.decay);
      const body=(Math.sin(phase)*.62+low*2.4)*p.weight*Math.exp(-t/(p.decay*1.25));
      const tail=low*.4*Math.exp(-t/.14)*(1-Math.exp(-t*120));
      const actionTime=t-p.action;
      const action=actionTime>0?(n-mid)*.13*Math.exp(-actionTime/.012):0;
      // A second brief metal return follows the bolt, especially audible on the SG-6.
      const returnTime=t-p.action-(p.returnDelay??.047);
      const bolt=returnTime>0?(Math.sin(returnTime*2*Math.PI*2150)*.035+(n-mid)*.075)*Math.exp(-returnTime/.009):0;
      data[i]=(crack+blast+body+tail+action+bolt)*attack*Math.min(1,(p.duration-t)/.02);
      peak=Math.max(peak,Math.abs(data[i]));
    }
    const gain=.88/Math.max(peak,.001);for(let i=0;i<data.length;i++)data[i]*=gain;
    return buffer;
  }
  cancelReload(){for(const source of this.reloadSounds)try{source?.stop();}catch{}this.reloadSounds=[];}
  cancelActorReload(id){const sources=this.actorReloads.get(id)||[];for(const source of sources)try{source?.stop();}catch{}this.actorReloads.delete(id);}
  reset(){this.cancelReload();for(const id of this.actorReloads.keys())this.cancelActorReload(id);for(const voice of this.voices)try{voice.stop();}catch{}this.voices.clear();this.walkers.clear();this.lastBeep=-Infinity;this.duckUntil=0;}
  setPaused(value){this.paused=!!value;if(value)this.reset();if(this.ctx)this.ambientGain.gain.setTargetAtTime(0,this.ctx.currentTime,.08);}
  spatial(pos){
    const me=this.listener;if(!pos||!me)return {volume:1,pan:0,distance:0,occluded:false};
    const dx=pos.x-me.x,dy=(pos.y||0)-((me.y||0)+1.4),dz=pos.z-me.z,distance=Math.hypot(dx,dy,dz);
    const occluded=distance>1&&wallHit({x:me.x,y:(me.y||0)+1.4,z:me.z},{x:dx/distance,y:dy/distance,z:dz/distance})<distance-.35;
    return {volume:1/(1+Math.max(0,distance-2)*.1)*(occluded?.4:1),pan:(dx*Math.cos(me.yaw||0)-dz*Math.sin(me.yaw||0))/Math.max(1,distance),distance,occluded};
  }
  playBuffer(buffer,{volume=1,pan=0,distance=0,occluded=false,delay=0,wet=.15,pitch=1}={}){
    if(!this.ctx||this.ctx.state!=='running'||this.paused||!buffer)return;
    if(this.voices.size>=48){const oldest=this.voices.values().next().value;oldest.stop();this.voices.delete(oldest);}
    const ctx=this.ctx,source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),panner=ctx.createStereoPanner(),send=ctx.createGain();
    source.buffer=buffer;source.playbackRate.value=pitch;filter.type='lowpass';filter.frequency.value=occluded?1100:Math.max(1500,16500/(1+distance*.09));
    gain.gain.value=volume;panner.pan.value=Math.max(-1,Math.min(1,pan));send.gain.value=wet;
    source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(this.worldBus);panner.connect(send);send.connect(this.room);
    this.voices.add(source);source.onended=()=>{this.voices.delete(source);for(const node of [source,gain,filter,panner,send])node.disconnect();};source.start(ctx.currentTime+delay);return source;
  }
  foleySound(name,volume=.2,pos=null,delay=0,pitch=1){const variants=this.foley[name],spatial=this.spatial(pos);return this.playBuffer(variants?.[Math.floor(Math.random()*variants.length)],{...spatial,volume:volume*spatial.volume,delay,pitch:pitch*(.97+Math.random()*.06),wet:pos?.25:.08});}
  cue(notes,volume=.07){notes.forEach(([freq,delay,duration=.12])=>this.tone(freq,duration,volume,'sine',null,delay));}
  tone(freq,duration,volume=.1,type='sine',end=null,delay=0){
    if(!this.ctx||this.ctx.state!=='running')return;
    this.master.gain.value=this.settings.volume*.7;
    if(this.paused)return;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime+delay;
    this.voices.add(o);
    o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);
    g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.002);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration);
    o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();};
  }
  burst(duration,volume,filter=2000,delay=0,highpass=0){
    if(!this.ctx||this.ctx.state!=='running'||this.paused)return;
    this.master.gain.value=this.settings.volume*.7;
    const s=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter(),t=this.ctx.currentTime+delay;
    s.buffer=this.noise;f.type=highpass?'bandpass':'lowpass';f.frequency.value=filter;f.Q.value=highpass?.65: .7;
    g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.001);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    s.connect(f);f.connect(g);g.connect(this.master);s.start(t,Math.random()*.04);s.stop(t+duration);
    this.voices.add(s);
    s.onended=()=>{this.voices.delete(s);s.disconnect();f.disconnect();g.disconnect();};
    return s;
  }
  shot(type,volume=1,pan=0,distance=0,occluded=false){
    if(!this.ctx||this.ctx.state!=='running')return;
    this.master.gain.value=this.settings.volume*.7;
    const variants=this.reports[type]||this.reports.rifle;
    this.playBuffer(variants[Math.floor(Math.random()*variants.length)],{volume:volume*(type==='scatter'?1:.83),pan,distance,occluded,wet:distance? .45:.26,pitch:.985+Math.random()*.03});
    if(!distance)this.duckUntil=this.ctx.currentTime+.16;
  }
  event(e,player,state){
    const a=state?.actors.find(a=>a.id===e.actor),me=state?.actors.find(a=>a.id===player);
    if(me)this.listener=me;
    const local=e.actor===player;
    if(e.type==='shot'){
      const spatial=local?{volume:1,pan:0,distance:0,occluded:false}:this.spatial(e.origin||a);
      this.shot(e.weapon,local?1:.68*spatial.volume,spatial.pan,spatial.distance,spatial.occluded);
      if(local&&e.weapon==='scatter')this.foleySound('bolt',.13,null,.17,.75);
    }
    if(e.type==='switch'){
      if(local)this.cancelReload();this.cancelActorReload(e.actor);
      this.foleySound('cloth',local?.13:.2,local?null:a);this.foleySound('bolt',local?.12:.22,local?null:a,(e.duration||.32)*.75);
    }
    if(e.type==='reload'){
      if(local)this.cancelReload();this.cancelActorReload(e.actor);
      const reload=e.duration||WEAPONS[e.weapon||a?.weapon]?.reload||1.5,pos=local?null:a;
      const sources=[this.foleySound('magOut',.28,pos,.08),this.foleySound('cloth',.14,pos,reload*.32),this.foleySound('magIn',.34,pos,reload*.68),this.foleySound('bolt',.28,pos,reload*.86)];
      this.actorReloads.set(e.actor,sources);if(local)this.reloadSounds=sources;
    }
    if(e.type==='damage'&&e.source===player){
      this.foleySound('body',.24,null,0,e.part==='weakpoint'?1.3:1);
      if(e.part==='weakpoint')this.cue([[1760,0,.045],[920,.05,.06]],.04);
    }
    if(e.type==='damage'&&local){this.foleySound('hurt',.38);this.tone(64,.16,.12,'sine',38);}
    if(e.type==='damage'&&!local&&a){this.foleySound('hurt',.45,a);if(e.source!==player)this.foleySound('body',.26,a);}
    if(e.type==='kill'){
      this.cancelActorReload(e.actor);if(local)this.cancelReload();
      this.foleySound('body',.38,local?null:a,0,.7);this.foleySound('cloth',.26,local?null:a,.12,.8);
    }
    if(e.type==='interact'&&a)this.foleySound('cloth',.2,local?null:a);
    if(e.type==='kill'&&e.source===player)this.cue([[880,0,.08],[440,.08,.1]],.045);
    if(e.type==='core')this.cue(e.state==='defused'||e.state==='completed'?[[660,0,.12],[880,.15,.2],[1100,.32,.23]]:[[660,0,.12],[880,.15,.16]],.11);
    if(e.type==='combat'||e.type==='order')this.tone(430,.11,.15,'triangle',750);
    if(e.type==='result')this.cue(e.winner===me?.squad?[[440,0,.28],[550,.18,.32],[660,.36,.45]]:[[330,0,.3],[277,.2,.4]],.1);
    if(e.type==='reloaded'){this.actorReloads.delete(e.actor);if(local)this.reloadSounds=[];}
    if(e.type==='round'||e.type==='result')this.walkers.clear();
  }
  update(state,actor,moving){
    if(!this.ctx)return;
    this.master.gain.setTargetAtTime(this.settings.volume*.7,this.ctx.currentTime,.025);
    const active=!!state&&state.phase==='combat'&&!this.paused;
    this.ambientGain.gain.setTargetAtTime(active?.12:0,this.ctx.currentTime,.35);
    this.worldBus.gain.setTargetAtTime(this.ctx.currentTime<this.duckUntil?.73:1,this.ctx.currentTime,.06);
    if(!state||!actor?.alive||this.paused)return;
    this.listener=actor;
    const round=state.round+':'+state.phase;
    if(round!==this.round){this.round=round;this.walkers.clear();this.lastStep=state.time;this.lastBeep=state.time;}
    if(moving&&active&&state.time-this.lastStep>(actor.sprinting?.28:.44)){
      this.lastStep=state.time;const metal=BOXES.some(b=>actor.x>=b.minX-.6&&actor.x<=b.maxX+.6&&actor.z>=b.minZ-.6&&actor.z<=b.maxZ+.6);
      this.foleySound(metal?'metalStep':'step',actor.sprinting?.13:.09);this.foleySound('cloth',.025);
    }
    if(active)for(const other of state.actors){if(!other.alive)continue;
      const prev=this.walkers.get(other.id),local=other.id===actor.id,pos=local?null:other;
      const current={x:other.x,z:other.z,y:other.y||0,stride:prev?.stride||0,time:state.time};this.walkers.set(other.id,current);
      if(!prev||state.time<=prev.time)continue;
      const dt=state.time-prev.time,travel=Math.hypot(other.x-prev.x,other.z-prev.z);
      if(dt>.5||travel>3){current.stride=0;continue;}
      if(prev.y<=.01&&current.y>.01){this.foleySound('cloth',.16,pos);current.stride=0;}
      if(prev.y>.01&&current.y<=.01){this.foleySound('step',.3,pos,0,.8);this.foleySound('cloth',.15,pos);current.stride=0;}
      if(local||current.y>.01||other.crouch||this.spatial(other).distance>28)continue;
      current.stride+=travel;
      const stride=other.sprinting?1.35:.95;
      if(current.stride>=stride){
        current.stride%=stride;
        const metal=BOXES.some(b=>other.x>=b.minX-.6&&other.x<=b.maxX+.6&&other.z>=b.minZ-.6&&other.z<=b.maxZ+.6);
        this.foleySound(metal?'metalStep':'step',other.sprinting?.26:.19,other);this.foleySound('cloth',.065,other);
      }
    }
    if(active&&['uploading','defusing'].includes(state.core.state)&&state.time-this.lastBeep>(state.core.upload<8?.35:.9)){this.lastBeep=state.time;this.tone(1000,.065,.05);}
  }
}
