import { chromium } from '@playwright/test';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.js';
import { dampMaskGLSL } from '../src/visual/damp-mask.js';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({production:true,port:0,host:'127.0.0.1'});
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try{
  browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);await page.waitForFunction(()=>window.__BLA);
  const coverage=await page.evaluate(mask=>{
    const g=window.__BLA,v=g.view;g.settings.quality='high';v.resize();
    const material=new v.wetFloor.material.constructor({
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 vUv;${mask}void main(){float wet=facilityDamp((vUv-.5)*vec2(80.,56.));gl_FragColor=vec4(vec3(wet),1.);}`
    });
    const target=new v.composer.renderTarget1.constructor(160,112,{type:1009,depthBuffer:false});
    const quad=new v.atmosphere._fsQuad.constructor(material),previous=v.renderer.getRenderTarget();
    const pixels=new Uint8Array(160*112*4);
    v.renderer.setRenderTarget(target);quad.render(v.renderer);v.renderer.readRenderTargetPixels(target,0,0,160,112,pixels);
    v.renderer.setRenderTarget(previous);quad.dispose();material.dispose();target.dispose();
    const areas={north:{wet:0,total:0},south:{wet:0,total:0},west:{wet:0,total:0},east:{wet:0,total:0},central:{wet:0,total:0}};
    for(let row=0;row<112;row++)for(let col=0;col<160;col++){
      const x=(col+.5)/160*80-40,z=(row+.5)/112*56-28;
      const name=z<-18?'north':z>18?'south':x<-28?'west':x>28?'east':'central';
      areas[name].total++;if(pixels[(row*160+col)*4]>64)areas[name].wet++;
    }
    return Object.fromEntries(Object.entries(areas).map(([name,a])=>[name,a.wet/a.total]));
  },dampMaskGLSL);
  for(const [name,fraction] of Object.entries(coverage)){
    assert.ok(fraction>.1,`${name} has visible puddle coverage (${fraction})`);
    assert.ok(fraction<.85,`${name} retains dry ground (${fraction})`);
  }
  const scenes=[];
  for(const [name,position,target] of [
    ['wet-north-power',[-6,1.65,-25],[4,1.1,-21]],
    ['wet-south-laboratory',[-22,1.65,25],[-10,1.1,20]],
    ['wet-gallery-lightshafts',[-36,1.65,16],[-33,2.1,0]],
    ['wet-freight-lightshafts',[-20,1.65,-16.1],[3,1.6,-13]]
  ]){
    const result=await page.evaluate(({position,target})=>{
      const v=window.__BLA.view;
      v.weaponPass.enabled=false;v.camera.position.fromArray(position);v.camera.lookAt(...target);v.camera.updateMatrixWorld(true);
      const nearby=[...v.localLights].sort((a,b)=>a.position.distanceToSquared(v.camera.position)-b.position.distanceToSquared(v.camera.position));
      for(const light of v.localLights)light.castShadow=nearby.indexOf(light)<2;
      v.wetFloor.material.uniforms.time.value=20;
      const sample=()=>{
        v.composer.render();
        const canvas=v.renderer.domElement,c=document.createElement('canvas');c.width=320;c.height=200;
        const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,320,200);
        return ctx.getImageData(0,0,320,200).data;
      };
      v.atmosphere.enabled=true;v.wetFloor.visible=true;sample();const full=sample();
      const image=v.renderer.domElement.toDataURL('image/png');
      const uniforms=v.atmosphere.uniforms;
      const synced=uniforms.cameraWorld.value.equals(v.camera.matrixWorld)&&uniforms.inverseProjection.value.equals(v.camera.projectionMatrixInverse)&&uniforms.shadowMatrix.value.equals(v.sun.shadow.matrix);
      const lamps=uniforms.lampPosition.value.filter(p=>p.w>0).length;
      v.atmosphere.enabled=false;const noMist=sample();v.atmosphere.enabled=true;
      const lampStrength=uniforms.lampStrength.value;uniforms.lampStrength.value=0;const noLamps=sample();uniforms.lampStrength.value=lampStrength;
      v.wetFloor.visible=false;const noWater=sample();v.wetFloor.visible=true;
      const difference=other=>{
        let changed=0,total=0;
        for(let i=0;i<full.length;i+=4){const d=Math.abs(full[i]-other[i])+Math.abs(full[i+1]-other[i+1])+Math.abs(full[i+2]-other[i+2]);if(d>9)changed++;total+=d;}
        return {changedFraction:changed/(full.length/4),meanDifference:total/(full.length/4*3)};
      };
      return {image,synced,lamps,mist:difference(noMist),lamplight:difference(noLamps),water:difference(noWater)};
    },{position,target});
    writeFileSync(`artifacts/${name}.png`,Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
    assert.ok(result.synced,`${name}: scattering follows camera movement`);
    assert.equal(result.lamps,2,`${name}: nearby lamp shadow maps are reused`);
    assert.ok(result.mist.changedFraction>.01,`${name}: volumetric light changes the rendered scene`);
    assert.ok(result.water.changedFraction>.005,`${name}: puddles reflect the rendered scene`);
    scenes.push({name,...result});
  }
  assert.ok(scenes.some(s=>s.lamplight.changedFraction>.01),'local lamps produce visible shafts independently of sunlight');
  assert.deepEqual(errors,[],'water and atmospheric shaders compile and render without errors');
  writeFileSync('artifacts/wet-light-report.json',JSON.stringify({passed:true,coverage,scenes,errors},null,2));
  console.log('Wet floor and light shafts passed:',JSON.stringify({coverage,scenes},null,2));
}finally{await browser?.close();await app.close();}
