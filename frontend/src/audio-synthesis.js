// Cached mechanical and environmental sounds. All envelopes end at zero.
const profiles={
  step:[.24,105,.035,.7,.28],metalStep:[.34,225,.075,.55,.3],cloth:[.22,800,.055,.08,.6],
  magOut:[.2,760,.025,.3,.55],magIn:[.24,430,.028,.55,.5],bolt:[.22,1850,.022,.35,.7],
  shell:[.34,4200,.065,.45,.22],concrete:[.32,330,.04,.25,.8],metal:[.48,2750,.075,.65,.5],
  body:[.2,170,.025,.5,.55],land:[.4,72,.065,.85,.35],hurt:[.32,62,.075,.8,.25],
  jump:[.24,680,.07,.08,.55],dry:[.09,1900,.012,.35,.5]
};
export function makeFoley(ctx,name){
  const [duration,freq,decay,tonal,noise]=profiles[name],rate=ctx.sampleRate;
  const buffer=ctx.createBuffer(1,Math.ceil(duration*rate),rate),data=buffer.getChannelData(0);let low=0,peak=0;
  const pitch=.93+Math.random()*.14;
  for(let i=0;i<data.length;i++){
    const t=i/rate,n=Math.random()*2-1;low+=.12*(n-low);
    const ring=(Math.sin(2*Math.PI*freq*pitch*t)+.4*Math.sin(2*Math.PI*freq*1.61*pitch*t)+.18*Math.sin(2*Math.PI*freq*2.37*t))*tonal;
    const grain=(freq<500?low*3:n-low)*noise;
    const envelope=(1-Math.exp(-t*1800))*Math.exp(-t/decay)*Math.min(1,(duration-t)/.02);
    data[i]=(ring+grain)*envelope;peak=Math.max(peak,Math.abs(data[i]));
  }
  for(let i=0;i<data.length;i++)data[i]*=.7/Math.max(.001,peak);
  return buffer;
}
export const FOLEY_NAMES=Object.keys(profiles);
export function makeAmbience(ctx){
  const rate=ctx.sampleRate,length=rate*6,buffer=ctx.createBuffer(2,length,rate);
  for(let c=0;c<2;c++){const data=buffer.getChannelData(c);let low=0;for(let i=0;i<length;i++){const t=i/rate;low+=.006*(Math.random()*2-1-low);data[i]=low*.45+Math.sin(2*Math.PI*50*t)*.008+Math.sin(2*Math.PI*100*t+c)*.004;}
    // Crossfade the seam without modulating the entire loop.
    const fade=Math.floor(rate*.15);for(let i=0;i<fade;i++){const k=i/fade;data[length-fade+i]=data[length-fade+i]*(1-k)+data[i]*k;}}
  return buffer;
}
