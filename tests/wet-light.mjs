import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from './app.mjs';
import { launchBrowser,waitForGame } from './browser-utils.mjs';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({port:0,host:'127.0.0.1'}),browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);await waitForGame(page);
  const coverage=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.webgpu.js'),{uv,vec2,vec3,vec4}=await import('/node_modules/three/build/three.tsl.js');
    const {facilityDamp}=await import('/src/visual/damp-mask.js');
    const g=window.__BLA,v=g.view;v.renderer.setAnimationLoop(null);g.settings.quality='high';v.resize();
    const material=new T.MeshBasicNodeMaterial();material.fragmentNode=vec4(vec3(facilityDamp(uv().sub(.5).mul(vec2(80,56)))),1);
    const quad=new T.QuadMesh(material),target=new T.RenderTarget(160,112,{depthBuffer:false}),previous=v.renderer.getRenderTarget();
    v.renderer.setRenderTarget(target);quad.render(v.renderer);const pixels=await v.renderer.readRenderTargetPixelsAsync(target,0,0,160,112);
    v.renderer.setRenderTarget(previous);material.dispose();target.dispose();
    const areas=Object.fromEntries(['north','south','west','east','central'].map(name=>[name,{wet:0,total:0}]));
    for(let row=0;row<112;row++)for(let col=0;col<160;col++){
      const x=(col+.5)/160*80-40,z=(row+.5)/112*56-28;
      const name=z<-18?'north':z>18?'south':x<-28?'west':x>28?'east':'central';
      areas[name].total++;if(pixels[(row*160+col)*4]>64)areas[name].wet++;
    }
    return Object.fromEntries(Object.entries(areas).map(([name,a])=>[name,a.wet/a.total]));
  });
  for(const [name,fraction] of Object.entries(coverage)){assert.ok(fraction>.1,`${name} has visible puddle coverage (${fraction})`);assert.ok(fraction<.85,`${name} retains dry ground (${fraction})`);}
  const scenes=[];
  for(const [name,position,target] of [
    ['wet-north-power',[-6,1.65,-25],[4,1.1,-21]],
    ['wet-south-laboratory',[-22,1.65,25],[-10,1.1,20]],
    ['wet-gallery-lightshafts',[-36,1.65,16],[-33,2.1,0]],
    ['wet-freight-lightshafts',[-20,1.65,-16.1],[3,1.6,-13]]
  ]){
    const result=await page.evaluate(async({position,target})=>{
      const v=window.__BLA.view;v.weaponVisible.value=0;v.camera.position.fromArray(position);v.camera.lookAt(...target);v.camera.updateMatrixWorld(true);
      const nearby=[...v.localLights].sort((a,b)=>a.position.distanceToSquared(v.camera.position)-b.position.distanceToSquared(v.camera.position));
      v.localLights.forEach(l=>l.intensity=l.userData.baseIntensity);
      v.localShadowLights.forEach((light,i)=>{const source=nearby[i];light.position.copy(source.position);light.target.position.copy(source.target.position);light.color.copy(source.color);light.intensity=source.intensity;source.intensity=0;light.shadow.autoUpdate=true;light.shadow.intensity=1;});
      v.wetFloor.material.uniforms.time.value=20;
      const output=new v.worldPass.renderTarget.constructor(320,200,{type:1009,depthBuffer:false});
      const sample=async()=>{
        // Read the composed GPU target directly, independently of canvas presentation.
        v.renderer._nodes.nodeFrame.update();v.atmosphere.update();v.renderer.setRenderTarget(output);v.composer.render();
        const pixels=await v.renderer.readRenderTargetPixelsAsync(output,0,0,320,200);v.renderer.setRenderTarget(null);return pixels;
      };
      v.atmosphere.enabled.value=1;v.wetFloor.visible=true;await sample();const full=await sample();
      v.composer.render();const image=v.renderer.domElement.toDataURL('image/png');
      const uniforms=v.atmosphere.uniforms,synced=uniforms.cameraWorld.value.equals(v.camera.matrixWorld)&&uniforms.inverseProjection.value.equals(v.camera.projectionMatrixInverse);
      const lamps=v.atmosphere.bindings.slice(1).filter(b=>b.active.value).length;
      v.atmosphere.enabled.value=0;const noMist=await sample();v.atmosphere.enabled.value=1;
      const lampStrength=uniforms.lampStrength.value;uniforms.lampStrength.value=0;const noLamps=await sample();uniforms.lampStrength.value=lampStrength;
      v.wetFloor.visible=false;const noWater=await sample();v.wetFloor.visible=true;
      const difference=other=>{let changed=0,total=0;for(let i=0;i<full.length;i+=4){const d=Math.abs(full[i]-other[i])+Math.abs(full[i+1]-other[i+1])+Math.abs(full[i+2]-other[i+2]);if(d>9)changed++;total+=d;}return {changedFraction:changed/(full.length/4),meanDifference:total/(full.length/4*3)};};
      output.dispose();return {image,synced,lamps,mist:difference(noMist),lamplight:difference(noLamps),water:difference(noWater)};
    },{position,target});
    writeFileSync(`artifacts/${name}.png`,Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
    console.log(name,result);
    assert.ok(result.synced,`${name}: scattering follows camera movement`);assert.equal(result.lamps,2,`${name}: nearby lamp shadow maps are reused`);
    assert.ok(result.mist.changedFraction>.01,`${name}: volumetric light changes the rendered scene`);assert.ok(result.water.changedFraction>.005,`${name}: puddles reflect the rendered scene`);
    scenes.push({name,...result});
  }
  assert.ok(scenes.some(s=>s.lamplight.changedFraction>.01),'local lamps produce visible shafts independently of sunlight');assert.deepEqual(errors,[]);
  writeFileSync('artifacts/wet-light-report.json',JSON.stringify({passed:true,coverage,scenes,errors},null,2));console.log('WebGPU wet floor and light shafts passed:',JSON.stringify({coverage,scenes},null,2));
}finally{await browser.close();await app.close();}
