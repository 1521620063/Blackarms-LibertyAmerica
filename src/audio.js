// Layered, cached weapon reports. No network assets or runtime oscillators per shot.
const REPORTS={
  rifle:{duration:.62,punch:112,weight:.54,crack:.85,decay:.055,action:.078},
  scatter:{duration:.9,punch:69,weight:.95,crack:.68,decay:.105,action:.19},
  pistol:{duration:.44,punch:165,weight:.32,crack:.78,decay:.037,action:.065}
};

export class AudioEngine {
  constructor(settings){this.settings=settings;this.ctx=null;this.noise=null;this.lastStep=0;this.lastBeep=0;this.reports={};}
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
    for(const [type,profile] of Object.entries(REPORTS))this.reports[type]=Array.from({length:5},()=>this.makeReport(profile));
  }
  makeReport(p){
    const rate=this.ctx.sampleRate,buffer=this.ctx.createBuffer(1,Math.ceil(rate*p.duration),rate),data=buffer.getChannelData(0);
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
      const returnTime=t-p.action-.047;
      const bolt=returnTime>0?(Math.sin(returnTime*2*Math.PI*2150)*.035+(n-mid)*.075)*Math.exp(-returnTime/.009):0;
      data[i]=(crack+blast+body+tail+action+bolt)*attack*Math.min(1,(p.duration-t)/.02);
      peak=Math.max(peak,Math.abs(data[i]));
    }
    const gain=.88/Math.max(peak,.001);for(let i=0;i<data.length;i++)data[i]*=gain;
    return buffer;
  }
  tone(freq,duration,volume=.1,type='sine',end=null){
    if(!this.ctx||this.ctx.state!=='running')return;
    this.master.gain.value=this.settings.volume*.7;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime;
    o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);
    g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.002);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g);g.connect(this.master);o.start();o.stop(t+duration);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  burst(duration,volume,filter=2000,delay=0,highpass=0){
    if(!this.ctx||this.ctx.state!=='running')return;
    this.master.gain.value=this.settings.volume*.7;
    const s=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter(),t=this.ctx.currentTime+delay;
    s.buffer=this.noise;f.type=highpass?'bandpass':'lowpass';f.frequency.value=filter;f.Q.value=highpass?.65: .7;
    g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.001);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    s.connect(f);f.connect(g);g.connect(this.master);s.start(t,Math.random()*.04);s.stop(t+duration);
    s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  }
  shot(type,volume=1,pan=0,distance=0){
    if(!this.ctx||this.ctx.state!=='running')return;
    this.master.gain.value=this.settings.volume*.7;
    const variants=this.reports[type]||this.reports.rifle,ctx=this.ctx;
    const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),panner=ctx.createStereoPanner();
    source.buffer=variants[Math.floor(Math.random()*variants.length)];source.playbackRate.value=.985+Math.random()*.03;
    filter.type='lowpass';filter.frequency.value=Math.max(1700,16500/(1+distance*.13));
    gain.gain.value=volume*(type==='scatter'?1:.83);panner.pan.value=Math.max(-1,Math.min(1,pan));
    source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(this.master);panner.connect(this.room);
    source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
  }
  event(e,player,state){
    const a=state?.actors.find(a=>a.id===e.actor),me=state?.actors.find(a=>a.id===player);
    const dist=a&&me?Math.hypot(a.x-me.x,a.z-me.z):0,local=e.actor===player;
    const volume=local?1:.62/(1+dist*.12);
    const pan=!local&&a&&me?((a.x-me.x)*Math.cos(me.yaw||0)-(a.z-me.z)*Math.sin(me.yaw||0))/Math.max(1,dist):0;
    if(e.type==='shot')this.shot(e.weapon,volume,pan,local?0:dist);
    if(e.type==='reload'&&local){
      this.burst(.045,.22,2400);this.burst(.08,.15,850,.13);
      const reload=e.duration||({rifle:2.1,scatter:2.6,pistol:1.5}[a?.weapon]||1.5);
      this.burst(.055,.24,3100,reload*.68);this.burst(.055,.18,4200,reload*.86);
    }
    if(e.type==='damage'&&e.source===player){
      this.burst(.045,.25,1700,0,1);this.burst(.023,.12,4800,.008,1);
      if(e.part==='weakpoint'){this.burst(.075,.18,7200,0,1);this.tone(1760,.045,.055,'sine',920);}
    }
    if(e.type==='damage'&&local){this.burst(.14,.38,430);this.tone(64,.16,.18,'sine',38);}
    if(e.type==='kill'&&e.source===player){this.burst(.085,.17,2800,0,1);this.tone(880,.1,.08,'sine',440);}
    if(e.type==='core'){this.tone(660,.2,.15);setTimeout(()=>this.tone(880,.2,.12),150);}
    if(e.type==='combat'||e.type==='order')this.tone(430,.11,.15,'triangle',750);
    if(e.type==='result'){this.tone(330,.5,.15);setTimeout(()=>this.tone(440,.5,.15),180);setTimeout(()=>this.tone(660,.6,.12),360);}
  }
  update(state,actor,moving){
    if(!state||!actor?.alive)return;
    if(moving&&state.phase==='combat'&&state.time-this.lastStep>(actor.sprinting?.28:.44)) {this.lastStep=state.time;this.burst(.045,.06,500);}
    if(['uploading','defusing'].includes(state.core.state)&&state.time-this.lastBeep>(state.core.upload<8?.35:.9)){this.lastBeep=state.time;this.tone(1000,.065,.05);}
  }
}
