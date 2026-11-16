import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { createServer } from '../server/index.js';
import { launchBrowser,waitForGame } from './browser-utils.mjs';

const app=await createServer({production:true,port:0,host:'127.0.0.1'}),browser=await launchBrowser();
mkdirSync('artifacts',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);await waitForGame(page);
  await page.locator('#start-offline').click();await page.locator('#ready').click();
  await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  await page.evaluate(()=>{
    const g=window.__BLA;g.pause();g.view.renderer.setAnimationLoop(null);
    // A fixed view of the lit staging area, independent of AI or pointer lock.
    const p=g.state.actors.find(a=>a.id===g.playerId);Object.assign(p,{x:-35,y:0,z:0,yaw:-Math.PI/2,pitch:0,alive:true,reload:0,switchTime:0});
    for(const el of document.querySelectorAll('.screen-overlay,#hud,#preparation'))el.hidden=true;
  });
  for(const size of [{width:1280,height:720},{width:3840,height:1958}]){
    await page.setViewportSize(size);
    for(const quality of ['high','medium','high','low','high']){
      const state=await page.evaluate(async quality=>{
        const g=window.__BLA,v=g.view;g.settings.quality=quality;v.resize();
        for(let i=0;i<3;i++)v.render(g.state,g.playerId,1/60,30,{yaw:-Math.PI/2,pitch:0});
        await v.renderer.backend.device.queue.onSubmittedWorkDone();
        const target=v.weaponPass.node.renderTarget;
        const pixel=await v.renderer.readRenderTargetPixelsAsync(target,Math.floor(target.width/2),Math.floor(target.height/2),1,1);
        return {weaponEnabled:v.weaponPass.enabled,backgroundAlpha:pixel[3],clearAlpha:v.renderer.getClearAlpha()};
      },quality);
      assert.equal(state.weaponEnabled,true);assert.equal(state.backgroundAlpha,0,'weapon background must remain transparent under every postprocessing pipeline');
      const screenshot=await page.screenshot();
      const brightness=await page.evaluate(async source=>{
        const image=new Image();image.src='data:image/png;base64,'+source;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,320,180);const pixels=ctx.getImageData(0,0,320,180).data;
        let sum=0,visible=0,count=0;
        // Upper central environment: exclude HUD, first-person weapon and sky.
        for(let y=40;y<90;y++)for(let x=90;x<230;x++){
          const i=(y*320+x)*4,l=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/255;
          sum+=l;visible+=l>.08?1:0;count++;
        }
        return {mean:sum/count,visibleFraction:visible/count};
      },screenshot.toString('base64'));
      assert.ok(brightness.mean>.08&&brightness.visibleFraction>.5,`final environment must be visible: ${JSON.stringify({size,quality,brightness})}`);
      checks.push({size,quality,...state,...brightness});
      if(quality==='high')writeFileSync(`artifacts/environment-high-${size.width}.png`,screenshot);
    }
  }
  assert.deepEqual(errors,[]);writeFileSync('artifacts/environment-report.json',JSON.stringify({checks,errors},null,2));
  console.log('Final environment compositing passed at 720p and 3840×1958 through repeated quality changes:',checks);
}finally{await browser.close();await app.close();}
