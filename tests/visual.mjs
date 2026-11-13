import { chromium } from '@playwright/test';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.js';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({production:true,port:0,host:'127.0.0.1'});
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try{
  browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);await page.waitForFunction(()=>window.__BLA);
  await page.locator('#start-offline').click();await page.locator('#ready').click();await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  const setup=await page.evaluate(()=>{
    const g=window.__BLA,m=g.match,v=g.view;g.pause();m.config.mode='core';
    for(const [i,a] of m.actors.entries())Object.assign(a,{x:i===0?-13.4:i===1?-10.3:i===3?-9.1:14,z:i===0?4.5:i===1?3.3:i===3?5.5:-8,y:0,yaw:i===3?Math.PI/2:-Math.PI/2,pitch:0,alive:true,hp:100,weapon:'rifle',reload:0});
    g.step(0);v.smoothPos=null;v.render(g.state,g.playerId,1/60,20,{yaw:-Math.PI/2,pitch:0});
    const actors=[...v.models.values()],human=actors.map(model=>{let skins=0,bones=0;model.userData.skin.traverse(o=>{if(o.isSkinnedMesh)skins++;if(o.isBone)bones++;});return {skins,bones,animations:Object.keys(model.userData.actions)};});
    return {human,sharedSkeleton:actors[0].userData.arms[0].upper===actors[1].userData.arms[0].upper,staticBatches:v.facility.children.filter(o=>o.isMesh&&!o.material.transparent).length};
  });
  for(const actor of setup.human){assert.ok(actor.skins>=2,'every actor has textured skinned human meshes');assert.equal(actor.bones,49,'human skeleton contains all 49 source joints');assert.deepEqual(actor.animations.sort(),['Idle','Run','Walk']);}
  assert.equal(setup.sharedSkeleton,false,'actors animate independently');assert.ok(setup.staticBatches<40,'static scenery is batched by material');
  const capture=async(name,mode)=>{
    const image=await page.evaluate(mode=>{
      const g=window.__BLA,v=g.view,p=g.match.actors[0];
      if(mode==='shot')v.event({type:'shot',actor:p.id,weapon:'rifle',origin:{x:p.x,y:1.57,z:p.z},traces:[{end:{x:-2.21,y:1.4,z:4.5},hit:false}]},p.id);
      if(mode==='pistol'||mode==='scatter'){p.weapon=mode;g.step(0);}
      v.smoothPos=null;v.render(g.state,g.playerId,1/60,20,{yaw:-Math.PI/2,pitch:0});
      if(mode==='portrait'){
        v.weaponPass.enabled=false;v.camera.position.set(-11.4,1.45,5.4);v.camera.lookAt(-9.1,1.1,5.5);v.composer.render();
      }
      return v.renderer.domElement.toDataURL('image/png');
    },mode);
    writeFileSync(`artifacts/${name}.png`,Buffer.from(image.split(',')[1],'base64'));
  };
  await capture('visual-combat','rifle');await capture('visual-soldier','portrait');await capture('visual-shot','shot');await capture('visual-pistol','pistol');await capture('visual-scatter','scatter');
  const checks=await page.evaluate(()=>{
    const g=window.__BLA,v=g.view,a=g.match.actors[1],model=v.models.get(a.id),u=model.userData;
    const leg=()=>{let q;u.skin.traverse(o=>{if(o.isBone&&o.name.endsWith('LeftUpLeg'))q=o.quaternion.toArray();});return q;};
    const before=leg();for(let i=0;i<20;i++){a.x+=.04;v.characters.animate(model,a,1/60);}const after=leg();
    const runWeight=(()=>{a.sprinting=true;for(let i=0;i<12;i++){a.x+=.08;v.characters.animate(model,a,1/60);}return u.actions.Run.getEffectiveWeight();})();
    const footPositions=()=>u.legs.map(leg=>leg.foot.getWorldPosition(v.camera.position.clone()).y);
    a.sprinting=false;u.speed=0;u.lastPosition=null;v.characters.animate(model,a,1/60);const feetBefore=footPositions();
    a.crouch=true;v.characters.animate(model,a,1/60);const feetCrouched=footPositions();a.crouch=false;
    const aim=v.camera.position.clone();u.aim.getWorldDirection(aim);
    const facing=aim.x*Math.sin(a.yaw)+aim.z*Math.cos(a.yaw);
    for(const quality of ['low','medium','high']){g.settings.quality=quality;v.resize();v.render(g.state,g.playerId,1/60,22,{yaw:-Math.PI/2,pitch:0});}
    const e={type:'shot',actor:a.id,weapon:'scatter',origin:{x:-13.4,y:1.57,z:4.5},traces:Array.from({length:8},()=>({end:{x:-2.21,y:1.4,z:4.5},hit:false}))};
    for(let i=0;i<120;i++)v.fx.shot(e,false);
    const limits={decals:v.fx.decals.length,traces:v.fx.traces.length,shells:v.fx.shells.length};v.fx.update(5);
    const expired=v.fx.traces.length===0&&v.fx.shells.every(p=>p.life<=0);
    v.fx.clear();return {before,after,runWeight,feetBefore,feetCrouched,facing,limits,expired,errors:g.errors,geometries:v.renderer.info.memory.geometries};
  });
  assert.notDeepEqual(checks.before,checks.after,'walking animates leg bones');assert.ok(checks.runWeight>.5,'sprinting blends into run animation');
  assert.ok(checks.feetBefore.every((y,i)=>Math.abs(y-checks.feetCrouched[i])<.04),'crouching bends the legs and keeps feet grounded');
  assert.ok(checks.facing>.99,'weapon forward matches actor yaw');
  assert.ok(checks.limits.decals<=80&&checks.limits.traces<=64&&checks.limits.shells===40,'effects have fixed limits');assert.ok(checks.expired,'transient effects expire');assert.deepEqual(checks.errors,[]);assert.deepEqual(errors,[]);
  writeFileSync('artifacts/visual-report.json',JSON.stringify({passed:true,setup,checks,errors},null,2));
  console.log('Visual acceptance passed: local skinned humans, independent skeletons, walk/run, weapons, three quality levels, batched scenery, bounded effects and no browser/GPU/resource errors.');
}finally{await browser?.close();await app.close();}
