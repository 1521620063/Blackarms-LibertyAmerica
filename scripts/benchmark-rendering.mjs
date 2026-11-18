import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createFrontendServer } from '../frontend/server.mjs';
import { launchBrowser, waitForGame } from '../tests/browser-utils.mjs';

// Use the production bundle and wait for the GPU, so the result includes real
// rendering work rather than just the cost of submitting command buffers.
const app=process.env.RENDER_URL?null:await createFrontendServer({production:true,port:0,host:'127.0.0.1',tls:false});
const browser=await launchBrowser();
try{
  const viewports=process.env.RENDER_WIDTH||process.env.RENDER_HEIGHT
    ?[{width:Number(process.env.RENDER_WIDTH)||1920,height:Number(process.env.RENDER_HEIGHT)||1080}]
    :[{width:1920,height:1080},{width:2560,height:1440}];
  const measurements=[],errors=[];
  const cases=process.env.RENDER_ABLATION?['high','no-reflections','no-shadows','no-atmosphere','medium','low','smoke','rear-view']:['high','medium','low','smoke','rear-view'];
  for(const viewport of viewports){
    const page=await browser.newPage({viewport,deviceScaleFactor:1});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(`${process.env.RENDER_URL||`http://127.0.0.1:${app.server.address().port}`}/?debug=1`);
    await waitForGame(page);
    await page.locator('#start-offline').click();await page.locator('#ready').click();
    await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
    await page.evaluate(()=>{
      const g=window.__BLA;g.pause();g.view.renderer.setAnimationLoop(null);
      const player=g.state.actors.find(actor=>actor.id===g.playerId);
      for(const [index,actor] of g.state.actors.entries())Object.assign(actor,{x:actor.squad?32:-32,y:0,z:(index%3-1)*2,yaw:actor.squad?Math.PI/2:-Math.PI/2,pitch:0,reload:0,switchTime:0,alive:true});
      Object.assign(player,{x:-35,y:0,z:0,yaw:-Math.PI/2,pitch:0,alive:true,reload:0,switchTime:0});
    });
    for(const variant of cases){
      const result=await page.evaluate(async variant=>{
        const g=window.__BLA,v=g.view,quality=['medium','low'].includes(variant)?variant:'high';
        g.settings.quality=quality;v.resize();
        v.renderer.info.autoReset=false;
        g.state.smokes=variant==='smoke'?[{id:41,x:-30,y:1.4,z:0,radius:3.2,remaining:14}]:[];
        const render=(index)=>{
          // The realtime loop normally advances this. Without it, nodes that
          // render once per frame reuse stale targets in this manual loop.
          v.renderer._nodes.nodeFrame.update();
          v.render(g.state,g.playerId,1/60,30+index/60,{yaw:variant==='rear-view'?Math.PI/2:-Math.PI/2,pitch:0,prepareOnly:true});
          if(variant==='no-reflections')v.wetFloor.visible=false;
          if(variant==='no-shadows')for(const light of [v.sun,v.gunLight,...v.localShadowLights]){light.shadow.autoUpdate=false;light.shadow.needsUpdate=false;}
          if(variant==='no-atmosphere')v.atmosphere.enabled.value=0;
          v.composer.render();
        };
        for(let i=0;i<8;i++){render(i);await v.renderer.backend.device.queue.onSubmittedWorkDone();}
        const samples=[],cpu=[],calls=[],triangles=[];
        for(let i=0;i<24;i++){
          v.renderer.info.reset();
          const start=performance.now();render(i);cpu.push(performance.now()-start);
          await v.renderer.backend.device.queue.onSubmittedWorkDone();
          samples.push(performance.now()-start);calls.push(v.renderer.info.render.drawCalls);triangles.push(v.renderer.info.render.triangles);
        }
        if(calls.some(count=>count<=1))throw new Error(`${variant}: a sample did not render the scene`);
        const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
        const size=target=>({width:target.width,height:target.height});
        return {variant,frameMs:median(samples),cpuMs:median(cpu),drawCalls:median(calls),triangles:median(triangles),width:v.renderer.domElement.width,height:v.renderer.domElement.height,reflection:v.wetFloor.visible?size(v.wetFloor.getRenderTarget()):null,volume:v.atmosphere.enabled.value?size(v.atmosphere.scatteringPass.renderTarget):null,samples};
      },variant);
      measurements.push({viewport,...result});
    }
    await page.close();
  }
  const report={viewports,measurements,errors};
  const output=process.argv[2]||'artifacts/rendering-benchmark.json';
  mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(errors.length)process.exitCode=1;
}finally{await browser.close();await app?.close();}
