export class AudioEngine {
  constructor(settings){this.settings=settings;this.ctx=null;this.noise=null;this.lastStep=0;this.lastBeep=0;}
  unlock(){
    if(!this.ctx){
      this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
      this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*.35,this.ctx.sampleRate);
      const values=this.noise.getChannelData(0);for(let i=0;i<values.length;i++)values[i]=Math.random()*2-1;
    }
    this.master.gain.value=this.settings.volume*.4;this.ctx.resume().catch(()=>{});
  }
  tone(freq,duration,volume=.1,type='sine',end=null){
    if(!this.ctx||this.ctx.state!=='running')return;
    this.master.gain.value=this.settings.volume*.4;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime;
    o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start();o.stop(t+duration);
  }
  burst(duration,volume,filter=2000){
    if(!this.ctx||this.ctx.state!=='running')return;
    const s=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter(),t=this.ctx.currentTime;
    s.buffer=this.noise;f.type='lowpass';f.frequency.value=filter;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    s.connect(f);f.connect(g);g.connect(this.master);s.start();s.stop(t+duration);
  }
  event(e,player,state){
    const a=state?.actors.find(a=>a.id===e.actor),me=state?.actors.find(a=>a.id===player);
    const dist=a&&me?Math.hypot(a.x-me.x,a.z-me.z):0,volume=e.actor===player?1:Math.max(.06,1-dist/30)*.4;
    if(e.type==='shot'){this.burst(.13,volume*.7,e.weapon==='scatter'?1300:3600);this.tone(e.weapon==='pistol'?440:150,.1,volume*.3,'sawtooth',45);}
    if(e.type==='reload'&&e.actor===player){this.burst(.07,.16,4500);this.tone(620,.05,.09,'square');}
    if(e.type==='damage'&&e.source===player)this.tone(e.part==='weakpoint'?1200:850,.055,.16,'sine');
    if(e.type==='damage'&&e.actor===player){this.burst(.12,.4,500);this.tone(80,.18,.25);}
    if(e.type==='kill'&&e.source===player){this.tone(620,.17,.2);setTimeout(()=>this.tone(930,.2,.15),75);}
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
