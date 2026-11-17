import { launchBrowser } from './browser-utils.mjs';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from './app.mjs';
const app=await createServer({port:0,host:'127.0.0.1'});
const executablePath=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try {
  browser=await launchBrowser();
  const page=await browser.newPage(),errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/`);
  const checks=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.webgpu.js');
    const {createRenderer,initializeRenderer}=await import('/src/visual/renderer.js');
    const {createMuzzleFlash}=await import('/src/visual/muzzle-flash.js');
    const {transparentPass,compositeOverlay}=await import('/src/visual/transparent-pass.js');
    const {vec4,uniform}=await import('/node_modules/three/build/three.tsl.js');
    const renderer=createRenderer({antialias:false});await initializeRenderer(renderer);renderer.setSize(128,128);
    const target=new T.RenderTarget(128,128,{type:T.FloatType});
    renderer.setRenderTarget(target);renderer.setClearColor(0x406080,1);
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-.25,.25,.25,-.25,.01,10);camera.position.z=1;
    const flash=createMuzzleFlash();scene.add(flash);
    const pixels=async()=>{renderer.render(scene,camera);return renderer.readRenderTargetPixelsAsync(target,0,0,128,128);};
    const baseline=await pixels(),results=[];flash.visible=true;
    for(const intensity of [0,.1,1,5]){
      flash.material.uniforms.intensity.value=intensity;
      const p=await pixels();let darker=0,brighter=0,invalid=0;
      for(let i=0;i<p.length;i++){if(!Number.isFinite(p[i]))invalid++;if(i%4===3)continue;if(p[i]<baseline[i]-.0001)darker++;if(p[i]>baseline[i]+.001)brighter++;}
      results.push({intensity,darker,brighter,invalid});
    }
    // Exercise the same transparent weapon pass and composition used in-game.
    // The flame has RGB energy but zero alpha outside the weapon silhouette.
    renderer.setRenderTarget(null);
    const visible=uniform(1),overlay=transparentPass(scene,camera,{samples:0});
    const composed=new T.PostProcessing(renderer,compositeOverlay(vec4(.05,.08,.12,1),overlay.getTextureNode(),visible));
    composed.outputColorTransform=false;
    const output=new T.RenderTarget(128,128,{type:T.FloatType});
    const composedPixels=async()=>{renderer.setRenderTarget(output);composed.render();return renderer.readRenderTargetPixelsAsync(output,0,0,128,128);};
    flash.material.uniforms.intensity.value=0;
    const before=await composedPixels();
    flash.material.uniforms.intensity.value=5;
    const after=await composedPixels();
    visible.value=0;const hidden=await composedPixels();
    let brighter=0,hiddenChanged=0;
    for(let i=0;i<after.length;i++){
      if(i%4===3)continue;
      if(after[i]>before[i]+.001)brighter++;
      if(Math.abs(hidden[i]-before[i])>.0001)hiddenChanged++;
    }
    results.push({intensity:5,brighter,darker:0,invalid:0,composited:true,hiddenChanged});
    renderer.setRenderTarget(null);composed.dispose();output.dispose();
    target.dispose();flash.geometry.dispose();flash.material.dispose();renderer.dispose();return results;
  });
  assert.deepEqual(errors,[]);
  for(const r of checks){assert.equal(r.invalid,0);assert.equal(r.darker,0,'flash must never darken the background');assert.ok(r.intensity===0?r.brighter===0:r.brighter>0);}
  assert.equal(checks.find(r=>r.composited).hiddenChanged,0,'disabled weapon overlay contributes no flame');
  console.log('Muzzle flash GPU checks passed:',checks);
} finally {await browser?.close();await app.close();}
