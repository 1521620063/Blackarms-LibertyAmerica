import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from '../server/index.js';
import { launchBrowser, waitForGame } from './browser-utils.mjs';

const app=await createServer({production:true,port:0,host:'127.0.0.1'}),base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await launchBrowser();mkdirSync('artifacts',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
    window.__graphicsContexts=[];const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){if(type!=='2d')window.__graphicsContexts.push(type);return getContext.call(this,type,...args);};
  });
  await page.goto(`${base}/?debug=1`);await waitForGame(page);
  const backends=await page.evaluate(()=>({main:window.__BLA.view.renderer.backend.isWebGPUBackend,preview:window.__BLA.weaponPreview.renderer.backend.isWebGPUBackend,contexts:window.__graphicsContexts}));
  assert.equal(backends.main,true);assert.equal(backends.preview,true);assert.ok(backends.contexts.includes('webgpu'));assert.ok(!backends.contexts.some(type=>/^webgl/.test(type)));
  await page.screenshot({path:'artifacts/webgpu-menu.png'});
  await page.locator('#start-offline').click();await page.locator('#ready').click();await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  const qualities=await page.evaluate(async()=>{
    const g=window.__BLA,v=g.view,result=[];g.pause();
    const p=g.match.actors.find(a=>a.id===g.playerId);p.x=-11;p.z=0;p.yaw=-Math.PI/2;
    for(const quality of ['low','medium','high']){
      g.settings.quality=quality;v.resize();v.render(g.state,g.playerId,1/60,20,{yaw:-Math.PI/2,pitch:0});
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const data=await v.renderer.readRenderTargetPixelsAsync(v.worldPass.renderTarget,0,0,160,90);
      let min=Infinity,max=0;for(let i=0;i<data.length;i++){if(i%4===3)continue;const bits=data[i],e=(bits>>10)&31,m=bits&1023,l=e===0?m*2**-24:(1+m/1024)*2**(e-15);min=Math.min(min,l);max=Math.max(max,l);}
      const antialias=v.composer.outputNode===(quality==='high'?v.highQualityOutput:quality==='medium'?v.mediumQualityOutput:v.lowQualityOutput);
      const smaaSize=quality==='high'?[v.smaa._renderTargetBlend.width,v.smaa._renderTargetBlend.height]:null;
      result.push({quality,antialias,smaaSize,resolution:[v.renderer.domElement.width,v.renderer.domElement.height],samples:v.weaponPass.node.renderTarget.samples,range:max-min,reflections:v.wetFloor.visible,atmosphere:v.atmosphere.enabled.value,shadows:v.localShadowLights.filter(l=>l.userData.active).length});
      await v.renderer.backend.device.queue.onSubmittedWorkDone();
    }
    v.makeGun('rifle');v.event({type:'shot',actor:g.playerId,weapon:'rifle',origin:{x:p.x,y:1.5,z:p.z},traces:[{end:{x:10,y:1,z:0},hit:false}]},g.playerId);
    v.render(g.state,g.playerId,1/240,21,{yaw:-Math.PI/2,pitch:0});return result;
  });
  assert.deepEqual(qualities.map(q=>[q.samples,q.reflections,q.atmosphere,q.shadows]),[[0,false,0,0],[0,true,1,1],[0,true,1,2]]);
  const firing=await page.evaluate(()=>{
    const g=window.__BLA,v=g.view,p=g.state.actors.find(a=>a.id===g.playerId);
    const remote=g.state.actors.find(a=>a.id!==g.playerId&&a.alive);
    const results=[];
    for(const dt of [1/60,1/30,.1]){
      for(const actor of [p,remote])v.event({type:'shot',actor:actor.id,weapon:actor.weapon,origin:{x:actor.x,y:1.5,z:actor.z},traces:[{end:{x:actor.x+5,y:1.5,z:actor.z},hit:false}]},g.playerId);
      v.render(g.state,g.playerId,dt,30,{yaw:0,pitch:0});
      const u=v.models.get(remote.id).userData;
      results.push({dt,local:v.muzzle.visible,intensity:v.muzzle.material.uniforms.intensity.value,remote:u.muzzle.visible,remoteIntensity:u.muzzle.material.uniforms.intensity.value,traces:v.fx.traces.length,smoke:Math.max(...v.fx.smoke.alphas)});
    }
    const colors=v.characters.sideMaterials.map(p=>({cloth:p.get('cloth').color.getHexString(),emissive:p.get('cloth').emissiveIntensity}));
    return {results,colors};
  });
  for(const frame of firing.results){
    assert.ok(frame.local&&frame.intensity>0,`local flash survives ${frame.dt}s render interval`);
    assert.ok(frame.remote&&frame.remoteIntensity>0,'remote weapon muzzle flashes');
    assert.ok(frame.traces>0&&frame.smoke>0,'new effects reach the drawn frame');
  }
  assert.notEqual(firing.colors[0].cloth,firing.colors[1].cloth);
  assert.ok(firing.colors.every(c=>c.emissive>0),'faction colors remain visible in shadow');
  console.log({firing});
  await page.screenshot({path:'artifacts/webgpu-combat.png'});
  console.log({qualities,errors});
  for(const q of qualities){
    assert.ok(q.range>.01,`${q.quality} renders a nonuniform scene`);
    assert.equal(q.antialias,true,`${q.quality} selects its antialiasing pipeline`);
  }
  const high=qualities.find(q=>q.quality==='high');
  assert.deepEqual(high.resolution,[1280,720],'high quality preserves the native 1280×720 viewport resolution');
  assert.deepEqual(high.smaaSize,high.resolution,'SMAA renders at the full internal resolution');
  assert.deepEqual(errors,[],'WebGPU shaders and pipelines render without browser errors');
  for(const missing of ['gpu','adapter']){
    const context=await browser.newContext();await context.addInitScript(kind=>{
      if(kind==='gpu')Object.defineProperty(navigator,'gpu',{get:()=>undefined});
      else navigator.gpu.requestAdapter=async()=>null;
      const original=HTMLCanvasElement.prototype.getContext;window.__legacy=false;
      HTMLCanvasElement.prototype.getContext=function(type,...args){if(/^webgl/.test(type))window.__legacy=true;return original.call(this,type,...args);};
    },missing);
    const unsupported=await context.newPage();await unsupported.goto(base);await unsupported.waitForFunction(()=>!document.getElementById('fatal').hidden);
    assert.match(await unsupported.locator('#fatal').textContent(),/WebGPU/);assert.equal(await unsupported.evaluate(()=>window.__legacy),false);await context.close();
  }
  writeFileSync('artifacts/webgpu-report.json',JSON.stringify({passed:true,backends,qualities,firing,errors},null,2));console.log('WebGPU: both renderers, all quality levels, combat effects and unavailable-device errors passed.');
}finally{await browser.close();await app.close();}
