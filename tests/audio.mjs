import { chromium } from '@playwright/test';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.js';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({port:0,host:'127.0.0.1'});
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try{
  browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--enable-unsafe-swiftshader','--disable-gpu-sandbox','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);
  await page.waitForFunction(()=>window.__BLA);
  const result=await page.evaluate(async()=>{
    const {AudioEngine}=await import('/src/audio.js');
    const audio=new AudioEngine({volume:.8});audio.unlock();await audio.ctx.resume();
    const me={id:'me',x:0,z:0,yaw:0,weapon:'rifle'},enemy={id:'enemy',x:8,z:-8,weapon:'scatter'},state={actors:[me,enemy]};
    for(const weapon of ['rifle','scatter','pistol']){
      audio.event({type:'shot',actor:'me',weapon},'me',state);
      audio.event({type:'shot',actor:'enemy',weapon},'me',state);
    }
    audio.event({type:'reload',actor:'me'},'me',state);
    audio.event({type:'damage',actor:'enemy',source:'me',part:'weakpoint'},'me',state);
    const reports={};
    for(const [type,variants] of Object.entries(audio.reports)){
      const sample=variants[0],values=sample.getChannelData(0);
      const rms=(from,to)=>{const start=Math.floor(from*sample.sampleRate),end=Math.min(values.length,Math.floor(to*sample.sampleRate));let energy=0;for(let i=start;i<end;i++)energy+=values[i]*values[i];return Math.sqrt(energy/(end-start));};
      let peak=0;for(const v of values)peak=Math.max(peak,Math.abs(v));
      reports[type]={duration:sample.duration,peak,attack:rms(0,.025),tail:rms(.3,.4),variants:variants.length,distinct:variants.every((b,i)=>!i||b.getChannelData(0)[100]!==values[100])};
      // Render the same gain, compressor and room graph used by the game.
      const offline=new OfflineAudioContext(2,48000*2,48000),render=new AudioEngine({volume:.8});render.ctx=offline;render.setup();
      const source=offline.createBufferSource();source.buffer=render.reports[type][0];
      source.connect(render.master);source.connect(render.room);source.start(.05);
      const buffer=await offline.startRendering(),left=buffer.getChannelData(0),right=buffer.getChannelData(1);
      let outputPeak=0;for(const channel of [left,right])for(const v of channel)outputPeak=Math.max(outputPeak,Math.abs(v));
      reports[type].outputPeak=outputPeak;
      // PCM WAV preview, including space reflections and the mix limiter.
      const bytes=new ArrayBuffer(44+left.length*4),view=new DataView(bytes);
      const text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
      text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,48000,true);view.setUint32(28,192000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,left.length*4,true);
      for(let i=0;i<left.length;i++){view.setInt16(44+i*4,Math.max(-1,Math.min(1,left[i]))*32767,true);view.setInt16(46+i*4,Math.max(-1,Math.min(1,right[i]))*32767,true);}
      let binary='';const array=new Uint8Array(bytes);for(let i=0;i<array.length;i+=8192)binary+=String.fromCharCode(...array.subarray(i,i+8192));reports[type].wav=btoa(binary);
    }
    await audio.ctx.close();return reports;
  });
  for(const [type,report] of Object.entries(result)){
    assert.equal(report.variants,5);assert.ok(report.distinct,'each report has independent variations');
    assert.ok(report.peak>.8&&report.peak<.9,'source reports have headroom');
    assert.ok(report.outputPeak>.05&&report.outputPeak<1,'room and limiter produce audible unclipped output');
    assert.ok(report.attack>report.tail*4,'reports have a strong attack and decaying tail');
    writeFileSync(`artifacts/audio-${type}.wav`,Buffer.from(report.wav,'base64'));delete report.wav;
  }
  assert.ok(result.scatter.duration>result.rifle.duration&&result.rifle.duration>result.pistol.duration);
  assert.deepEqual(errors,[]);
  writeFileSync('artifacts/audio-report.json',JSON.stringify({passed:true,reports:result,errors},null,2));
  console.log('Weapon audio passed: all event paths, five variations per weapon, transient/decay, unclipped offline mix, stereo WAV previews.');
}finally{await browser?.close();await app.close();}
