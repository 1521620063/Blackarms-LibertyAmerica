import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderPacer, renderPixelRatio, renderEffectScale } from '../frontend/src/visual/performance.js';

test('render cap keeps its cadence across common display refresh rates',()=>{
  for(const refresh of [60,120,144,165,240]){
    for(const cap of [15,30,60]){
      const pacer=new RenderPacer();let frames=0,elapsed=0;
      for(let i=0;i<refresh*10;i++){
        const dt=pacer.tick(i*1000/refresh,cap);
        if(dt!==null){frames++;elapsed+=dt;}
      }
      assert.ok(Math.abs(frames-cap*10)<=1,`${refresh}Hz / ${cap} FPS: ${frames}`);
      assert.ok(Math.abs(elapsed-10)<.1,'animation time follows elapsed time after skipped frames');
    }
  }
});

test('hidden rendering stops and resumes without accumulating a large animation delta',()=>{
  const pacer=new RenderPacer();
  assert.notEqual(pacer.tick(0,60),null);
  assert.equal(pacer.tick(5,60),null);
  assert.equal(pacer.tick(1000,60,false),null);
  assert.equal(pacer.tick(60000,60,false),null);
  assert.equal(pacer.tick(61000,60),1/60);
  assert.notEqual(pacer.tick(61001,15),null,'pause changes the pacing immediately');
  assert.equal(pacer.tick(61002,15),null);
  assert.notEqual(pacer.tick(61003,0),null,'uncapped mode resumes immediately');
  assert.notEqual(pacer.tick(61004,0),null);
});

test('fog and reflection budgets remain bounded at 1080p, 1440p and high display density',()=>{
  for(const [width,height] of [[1920,1080],[2560,1440],[3440,1440]]){
    for(const dpr of [1,1.25,1.5,2]){
      for(const quality of ['medium','high']){
        const ratio=renderPixelRatio(width,height,dpr,quality),w=width*ratio,h=height*ratio;
        const budget=quality==='high'?640*360:480*270;
        for(const limit of [1/4,quality==='high'?1/3:1/4]){
          const scale=renderEffectScale(w,h,quality,limit);
          assert.ok(w*h*scale*scale<=budget+1,'display density does not multiply effect cost');
          assert.ok(scale<=limit,'effects never upscale small drawing buffers');
        }
      }
    }
  }
});

test('quality pixel budgets bound render cost on high resolution displays',()=>{
  const budgets={low:1280*720,medium:1920*1080,high:2560*1440};
  for(const [width,height,dpr] of [[1280,720,1],[1920,1080,2],[3840,2160,2],[5120,1440,1]]){
    for(const [quality,budget] of Object.entries(budgets)){
      const scale=renderPixelRatio(width,height,dpr,quality);
      assert.ok(width*height*scale*scale<=budget+1);
      assert.ok(scale<=dpr);
    }
  }
  assert.equal(renderPixelRatio(1920,1080,1,'high'),1,'high quality preserves native resolution on 1x screens');
  assert.equal(renderPixelRatio(2560,1440,1,'high'),1,'native resolution stays within the pixel budget');
  assert.equal(renderPixelRatio(1280,720,1,'medium'),1);
  assert.equal(renderPixelRatio(3840,2160,2,'medium'),.5);
});
