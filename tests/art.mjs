import { chromium } from '@playwright/test';
import { existsSync,readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.js';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({production:true,port:0,host:'127.0.0.1'}),base=`http://127.0.0.1:${app.server.address().port}`;
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try{
  browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
  await page.goto(`${base}/?debug=1`);await page.waitForFunction(()=>window.__BLA);
  const materials=await page.evaluate(()=>{
    const v=window.__BLA.view;
    return {assets:v.artAssets,materials:['wall','concrete','floor','steel','dark','edge','armor','olive','sand','panel'].map(name=>{
      const m=v.materials[name];return {name,maps:[m.map,m.normalMap,m.roughnessMap].map(t=>({name:t.name,width:t.image.width,height:t.image.height,colorSpace:t.colorSpace,source:t.userData.source})),repeat:m.map.repeat.toArray()};
    })};
  });
  assert.deepEqual(materials.assets,['concrete','fabric','floor','gunmetal','service-panel']);
  for(const material of materials.materials)for(const [i,map] of material.maps.entries()){
    assert.equal(map.source,'generated-art');assert.equal(map.width,1024);assert.equal(map.height,1024);assert.equal(map.colorSpace,i===0?'srgb':'');
  }
  assert.deepEqual(materials.materials.find(m=>m.name==='floor').repeat,[28,18]);
  const characterMaterials=await page.evaluate(()=>{
    const characters=window.__BLA.view.characters;
    const palettes=characters.sideMaterials.map(palette=>[...palette.values()]
      .filter(m=>['cloth','armor','webbing'].includes(m.userData.role))
      .map(m=>({role:m.userData.role,maps:[m.map,m.normalMap,m.roughnessMap].map(t=>({width:t.image.width,height:t.image.height,colorSpace:t.colorSpace,source:t.userData.source}))})));
    return {assets:characters.surfaceAssets,palettes};
  });
  assert.deepEqual(characterMaterials.assets,['soldier-fabric','soldier-nylon']);
  for(const palette of characterMaterials.palettes)for(const material of palette)for(const [i,map] of material.maps.entries()){
    assert.equal(map.source,'generated-character-art');assert.equal(map.width,1024);assert.equal(map.height,1024);assert.equal(map.colorSpace,i===0?'srgb':'');
  }
  const manifest=JSON.parse(readFileSync('public/art/manifest.json','utf8')),characterManifest=JSON.parse(readFileSync('public/art/characters/manifest.json','utf8')),checks=[];
  const allAssets={...manifest.assets,...characterManifest.assets};
  for(const [id,asset] of Object.entries(allAssets)){
    const check=await page.evaluate(async({base,id,asset})=>{
      const image=new Image();image.src=base+asset.channels.albedo.url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const p=ctx.getImageData(0,0,1024,1024).data;
      let max=0,total=0;for(let i=0;i<1024;i++)for(let c=0;c<3;c++){
        const h=Math.abs(p[(i*1024)*4+c]-p[(i*1024+1023)*4+c]),v=Math.abs(p[i*4+c]-p[(1023*1024+i)*4+c]);max=Math.max(max,h,v);total+=h+v;
      }
      return {id,tileable:asset.tileable,decodedEdgeMean:total/(1024*6),decodedEdgeMax:max};
    },{base,id,asset});
    if(check.tileable)assert.ok(check.decodedEdgeMean<5,`${id}: compressed edges should remain smooth (${check.decodedEdgeMean})`);
    checks.push(check);
  }
  await page.screenshot({path:'artifacts/generated-art-menu.png'});
  await page.locator('#start-offline').click();await page.locator('#ready').click();await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  await page.evaluate(()=>window.__BLA.pause());await page.screenshot({path:'artifacts/generated-art-gameplay.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[],'runtime uses local assets and does not call the image service');
  const bytes=Object.values(allAssets).reduce((sum,a)=>sum+Object.values(a.channels).reduce((s,c)=>s+c.bytes,0),0);
  writeFileSync('artifacts/generated-art-report.json',JSON.stringify({passed:true,materials,characterMaterials,checks,bytes,errors,external},null,2));
  console.log(`Generated art acceptance passed: 7 source assets / 21 maps, sRGB and linear data, decoded tile edges, local runtime, no browser errors. Total ${(bytes/1024/1024).toFixed(2)} MiB.`);
}finally{await browser?.close();await app.close();}
