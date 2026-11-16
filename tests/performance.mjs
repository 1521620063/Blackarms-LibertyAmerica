import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from '../server/index.js';
import { launchBrowser, waitForGame } from './browser-utils.mjs';

const app=await createServer({production:true,port:0,host:'127.0.0.1'}),browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);await waitForGame(page);
  await page.evaluate(()=>{
    const v=window.__BLA.view,render=v.render.bind(v);window.__renderCount=0;
    v.render=(...args)=>{window.__renderCount++;return render(...args);};
  });
  await page.waitForFunction(()=>window.__renderCount>=3,null,{timeout:30000});
  const measure=()=>page.evaluate(async()=>{
    const start=performance.now(),before=window.__renderCount;
    await new Promise(resolve=>setTimeout(resolve,1500));
    const calls=window.__renderCount-before,seconds=(performance.now()-start)/1000;
    return {calls,seconds,fps:calls/seconds};
  });
  const menu=await measure();assert.ok(menu.calls>0&&menu.fps<=32,JSON.stringify(menu));
  await page.locator('#open-settings').click();await page.locator('[name="maxFPS"]').selectOption('30');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bla.settings')).maxFPS),30);
  await page.locator('#settings .close-dialog').click();
  await page.locator('#start-offline').click();await page.locator('#ready').click();
  await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  const combat=await measure();assert.ok(combat.calls>0&&combat.fps<=32,JSON.stringify(combat));
  await page.evaluate(()=>window.__BLA.pause());
  const paused=await measure();assert.ok(paused.calls>0&&paused.fps<=17,JSON.stringify(paused));
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
  const hidden=await measure();assert.equal(hidden.calls,0);
  await page.evaluate(()=>{delete document.hidden;});
  const resumed=await measure();assert.ok(resumed.calls>0&&resumed.fps<=17,JSON.stringify(resumed));
  await page.setViewportSize({width:3840,height:2160});
  const resolution=await page.evaluate(()=>{
    const g=window.__BLA,v=g.view;g.settings.quality='medium';v.resize();
    const canvas=v.renderer.domElement;return {width:canvas.width,height:canvas.height,ratio:v.renderer.getPixelRatio()};
  });
  assert.equal(resolution.width,1920);assert.equal(resolution.height,1080);
  assert.deepEqual(errors,[]);
  const report={menu,combat,paused,hidden,resumed,resolution,errors};
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/performance-report.json',JSON.stringify(report,null,2));
  console.log(report);
}finally{await browser.close();await app.close();}
