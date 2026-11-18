// Keep GPU work bounded independently of simulation and network updates.
export class RenderPacer {
  constructor(){this.lastTime=null;this.nextTime=0;this.rate=null;}
  tick(now,rate,visible=true){
    if(!visible){this.lastTime=null;this.nextTime=0;return null;}
    if(this.rate!==rate){this.rate=rate;this.nextTime=0;}
    if(now<this.nextTime-.5)return null;
    const dt=this.lastTime===null?1/60:Math.min((now-this.lastTime)/1000,.1);
    this.lastTime=now;
    if(rate>0){
      const interval=1000/rate;
      // Preserve the cadence on displays whose refresh rate differs from the cap.
      this.nextTime=this.nextTime>0?this.nextTime+Math.max(1,Math.floor((now-this.nextTime)/interval)+1)*interval:now+interval;
    }else this.nextTime=now;
    return dt;
  }
}

// Reflections and fog have their own pixel budgets at 1080p and 1440p.
// Base this on drawing-buffer dimensions so display density cannot multiply cost.
export function renderEffectScale(width,height,quality,maxScale=1/4){
  const pixels=quality==='high'?640*360:480*270;
  return Math.min(maxScale,Math.sqrt(pixels/(Math.max(1,width)*Math.max(1,height))));
}

export function renderPixelRatio(width,height,deviceRatio,quality,resolution=1){
  const cap=quality==='low'?.75:quality==='high'?1.75:1.25;
  const pixels=quality==='low'?960*540:quality==='high'?2560*1440:1920*1080;
  return Math.min(deviceRatio,cap,Math.sqrt(pixels/(Math.max(1,width)*Math.max(1,height))))*resolution;
}

const autoProfiles=[
  {quality:'low',resolution:2/3},
  {quality:'low',resolution:.8},
  {quality:'low',resolution:1},
  {quality:'medium',resolution:1},
  {quality:'high',resolution:1},
];

// Measure delivered frames, not the CPU cost of submitting GPU commands.
export class AdaptiveQuality {
  constructor(){this.level=2;this.backoff=8;this.resetSamples();}
  get profile(){return autoProfiles[this.level];}
  resetSamples(){this.start=null;this.frames=0;this.stable=0;this.slow=0;}
  sample(now,maxFPS){
    if(this.start===null){this.start=now;return false;}
    this.frames++;
    const elapsed=now-this.start;
    if(elapsed<1000)return false;
    const fps=this.frames*1000/elapsed,target=Math.min(maxFPS||60,60);
    this.start=now;this.frames=0;
    this.slow=fps<target*.78?this.slow+1:0;
    this.stable=fps>=target*.95?this.stable+elapsed/1000:0;
    let next=this.level;
    if(fps<target*.5)next=Math.max(0,this.level-2);
    else if(this.slow>=2)next=Math.max(0,this.level-1);
    else if(this.stable>=this.backoff)next=Math.min(autoProfiles.length-1,this.level+1);
    if(next===this.level)return false;
    if(next<this.level)this.backoff=Math.min(120,this.backoff*2);
    this.level=next;this.resetSamples();return true;
  }
}
