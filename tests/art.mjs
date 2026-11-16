import { chromium } from '@playwright/test';
import { existsSync,readFileSync,writeFileSync,mkdirSync,statSync } from 'node:fs';
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
    return {assets:v.artAssets,facilityAssets:v.facilityAssets,scannedAssets:v.scannedAssets,environment:v.environment.userData.source,materials:['wall','concrete','floor','steel','dark','edge','armor','olive','sand','panel','stagingFloor','paintedWall','containerRed','containerGreen','rack','hvac','crane'].map(name=>{
      const m=v.materials[name];return {name,maps:[m.map,m.normalMap,m.roughnessMap].map(t=>({name:t.name,width:t.image.width,height:t.image.height,colorSpace:t.colorSpace,source:t.userData.source})),repeat:m.map.repeat.toArray()};
    })};
  });
  assert.deepEqual(materials.assets,['fabric','gunmetal','service-panel']);
  assert.deepEqual(materials.facilityAssets,['facility-epoxy','facility-paint','facility-plaster']);
  assert.deepEqual(materials.scannedAssets,['concrete_floor_02','concrete_wall_008','empty_warehouse_01']);assert.equal(materials.environment,'cc0-hdr');
  for(const material of materials.materials)for(const [i,map] of material.maps.entries()){
    const scanned=['wall','concrete','floor'].includes(material.name),size=scanned?2048:1024;
    const facility=['stagingFloor','paintedWall','containerRed','containerGreen','rack','hvac','crane'].includes(material.name);
    assert.equal(map.source,scanned?'scanned-cc0':facility?'generated-facility-art':'generated-art');assert.equal(map.width,size);assert.equal(map.height,size);assert.equal(map.colorSpace,i===0?'srgb':'');
  }
  assert.deepEqual(materials.materials.find(m=>m.name==='floor').repeat,[14,9]);
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
  const scannedChecks=await page.evaluate(async()=>{
    const v=window.__BLA.view,checks=[];
    for(const name of ['floor','wall']){
      const image=v.materials[name].normalMap.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
      let deviation=0,z=0,count=0;for(let y=32;y<canvas.height;y+=64)for(let x=32;x<canvas.width;x+=64){const i=(y*canvas.width+x)*4,n=[pixels[i]/127.5-1,pixels[i+1]/127.5-1,pixels[i+2]/127.5-1];deviation+=Math.abs(Math.hypot(...n)-1);z+=n[2];count++;}
      checks.push({name,meanLengthError:deviation/count,meanZ:z/count});
    }
    const adapter=await navigator.gpu?.requestAdapter();return {checks,webgpu:!!navigator.gpu,adapter:!!adapter};
  });
  for(const check of scannedChecks.checks){assert.ok(check.meanLengthError<.08,`${check.name}: normals remain normalized`);assert.ok(check.meanZ>.5,`${check.name}: normals face out of the surface`);}
  const scannedManifest=JSON.parse(readFileSync('public/art/scanned/manifest.json','utf8'));
  assert.equal(scannedManifest.license,'CC0-1.0');
  const scannedBytes=scannedManifest.assets.reduce((sum,a)=>sum+(a.file?statSync(`public/art/scanned/${a.file}`).size:Object.values(a.channels).reduce((n,file)=>n+statSync(`public/art/scanned/${file}`).size,0)),0);
  await page.screenshot({path:'artifacts/generated-art-menu.png'});
  await page.locator('#start-offline').click();await page.locator('#ready').click();await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  await page.evaluate(()=>window.__BLA.pause());await page.screenshot({path:'artifacts/generated-art-gameplay.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[],'runtime uses local assets and does not call the image service');
  const bytes=Object.values(allAssets).reduce((sum,a)=>sum+Object.values(a.channels).reduce((s,c)=>s+c.bytes,0),0);
  writeFileSync('artifacts/generated-art-report.json',JSON.stringify({passed:true,materials,characterMaterials,scannedChecks,scannedBytes,checks,bytes,errors,external},null,2));
  console.log(`Art acceptance passed: generated surfaces, 2K CC0 scan normals, HDR reflections, sRGB and linear data, local runtime, no browser errors. Scanned pack ${(scannedBytes/1024/1024).toFixed(2)} MiB; generated pack ${(bytes/1024/1024).toFixed(2)} MiB.`);
}finally{await browser?.close();await app.close();}
