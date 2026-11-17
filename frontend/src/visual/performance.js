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

export function renderPixelRatio(width,height,deviceRatio,quality){
  const cap=quality==='low'?.8:quality==='high'?1.75:1.25;
  const pixels=quality==='low'?1280*720:quality==='high'?2560*1440:1920*1080;
  return Math.min(deviceRatio,cap,Math.sqrt(pixels/(Math.max(1,width)*Math.max(1,height))));
}
