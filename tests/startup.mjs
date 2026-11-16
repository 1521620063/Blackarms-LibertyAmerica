import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from '../server/index.js';
import { launchBrowser, waitForGame } from './browser-utils.mjs';

const app=await createServer({production:true,port:0,host:'127.0.0.1'});
let browser;
try{
  browser=await launchBrowser();
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);
  await waitForGame(page);
  await page.evaluate(()=>{
    const v=window.__BLA.view,render=v.render.bind(v);
    window.startupFrames=[];
    v.render=(...args)=>{
      const start=performance.now(),result=render(...args);
      if(args[0])window.startupFrames.push(performance.now()-start);
      return result;
    };
    window.cachedWeapons=new Map(v.gunCache);
  });
  const report=[];
  for(const [mode,primary,teamSize] of [
    ['elimination','rifle',3],['core','scatter',3],['elimination','smg',1],
    ['core','dmr',2],['elimination','lmg',3],['core','sniper',3],
    ['elimination','rifle',3]
  ]){
    await page.evaluate(({mode,primary,teamSize})=>{
      Object.assign(window.__BLA.config,{mode,primary,teamSize});
      window.startupFrames=[];
    },{mode,primary,teamSize});
    await page.locator('#start-offline').click();
    await page.waitForFunction(()=>window.startupFrames.length>=3);
    const sample=await page.evaluate(()=>({frames:window.startupFrames.slice(0,3),errors:window.__BLA.errors}));
    assert.ok(Math.max(...sample.frames)<1500,`combat frame stalled: ${JSON.stringify({mode,primary,...sample})}`);
    assert.deepEqual(sample.errors,[]);
    report.push({mode,primary,teamSize,...sample});
    await page.evaluate(()=>{
      const v=window.__BLA.view;
      for(const [type,cached] of window.cachedWeapons){
        if(v.gunCache.get(type)!==cached)throw new Error(`Rebuilt cached weapon: ${type}`);
      }
      document.getElementById('quit').click();
    });
  }
  assert.deepEqual(errors,[]);
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/startup-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await app.close();}
