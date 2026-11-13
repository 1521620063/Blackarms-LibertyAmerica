import { chromium } from '@playwright/test';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.js';
import { MAP, BOXES, SPAWNS, OBJECTIVE, ZONES } from '../src/shared/data.js';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({production:true,port:0,host:'127.0.0.1'});
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try{
  browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],characterRequests=[];
  page.on('request',r=>{if(/\.(glb|gltf|fbx)(?:\?|$)/i.test(r.url()))characterRequests.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);await page.waitForFunction(()=>window.__BLA);
  await page.locator('#start-offline').click();await page.locator('#ready').click();await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  const setup=await page.evaluate(()=>{
    const g=window.__BLA,m=g.match,v=g.view;g.pause();m.config.mode='core';
    for(const [i,a] of m.actors.entries())Object.assign(a,{x:i===0?-13.4:i===1?-10.3:i===3?-9.1:14,z:i===0?4.5:i===1?3.3:i===3?5.5:-8,y:0,yaw:i===3?Math.PI/2:-Math.PI/2,pitch:0,alive:true,hp:100,weapon:'rifle',reload:0});
    g.step(0);v.smoothPos=null;
    for(let frame=0;frame<90;frame++)v.render(g.state,g.playerId,1/60,20+frame/60,{yaw:-Math.PI/2,pitch:0});
    const actors=[...v.models.values()],human=actors.map(model=>{let skins=0,bones=0;model.userData.skin.traverse(o=>{if(o.isSkinnedMesh)skins++;if(o.isBone)bones++;});return {skins,bones,animations:Object.keys(model.userData.actions)};});
    return {human,source:v.characters.template.userData.source,blendedVertices:v.characters.template.userData.blendedVertices,sharedSkeleton:actors[0].userData.arms[0].upper===actors[1].userData.arms[0].upper,staticBatches:v.facility.children.filter(o=>o.isMesh&&!o.material.transparent).length};
  });
  for(const actor of setup.human){assert.equal(actor.skins,11,'character batches eleven surface materials');assert.equal(actor.bones,33,'original skeleton contains 33 authored joints');assert.deepEqual(actor.animations.sort(),['Idle','Run','Walk']);}
  assert.ok(setup.blendedVertices>5000,'elbows, shoulders and knees use blended skin weights');
  assert.equal(setup.source,'original-procedural');assert.deepEqual(characterRequests,[],'characters load without any imported model file');
  assert.equal(setup.sharedSkeleton,false,'actors animate independently');assert.ok(setup.staticBatches<40,'static scenery is batched by material');
  const capture=async(name,mode)=>{
    const image=await page.evaluate(mode=>{
      const g=window.__BLA,v=g.view,p=g.match.actors[0];
      if(mode==='shot')v.event({type:'shot',actor:p.id,weapon:'rifle',origin:{x:p.x,y:1.57,z:p.z},traces:[{end:{x:-2.21,y:1.4,z:4.5},hit:false}]},p.id);
      if(['pistol','scatter','smg','dmr','lmg','sniper'].includes(mode)){p.weapon=mode;g.step(0);}
      v.smoothPos=null;v.render(g.state,g.playerId,1/60,20,{yaw:-Math.PI/2,pitch:0});
      if(mode==='portrait'){
        v.weaponPass.enabled=false;v.camera.position.set(-11.4,1.45,5.4);v.camera.lookAt(-9.1,1.1,5.5);v.composer.render();
      }
      return v.renderer.domElement.toDataURL('image/png');
    },mode);
    writeFileSync(`artifacts/${name}.png`,Buffer.from(image.split(',')[1],'base64'));
  };
  await capture('visual-combat','rifle');await capture('visual-soldier','portrait');await capture('visual-shot','shot');await capture('visual-pistol','pistol');await capture('visual-scatter','scatter');
  for(const type of ['smg','dmr','lmg','sniper'])await capture(`visual-${type}`,type);
  for(const [name,position,target] of [
    ['map-north-freight',[-20,1.65,-16.1],[3,1.4,-13]],
    ['map-south-service',[-7,1.65,16.8],[5,1.3,13]],
    ['map-staging',[-25,1.65,3],[-16,1.4,-5]]
  ]){
    const image=await page.evaluate(({position,target})=>{
      const v=window.__BLA.view;v.weaponPass.enabled=false;v.camera.position.fromArray(position);v.camera.lookAt(...target);v.composer.render();return v.renderer.domElement.toDataURL('image/png');
    },{position,target});
    writeFileSync(`artifacts/${name}.png`,Buffer.from(image.split(',')[1],'base64'));
  }
  const overview=await page.evaluate(({map,boxes,spawns,objective,zones})=>{
    const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=1020;const c=canvas.getContext('2d');
    const scale=23,px=x=>720+x*scale,pz=z=>535+z*scale;
    c.fillStyle='#142027';c.fillRect(0,0,1440,1020);c.fillStyle='#e3ebe4';c.font='bold 32px Arial';c.fillText('BLACKARMS / FACILITY EXPANSION',70,56);
    c.fillStyle='#9eb4b9';c.font='19px Arial';c.fillText(`${map.width} × ${map.depth} m  /  NORTH FREIGHT · CENTRAL CONTROL · SOUTH SERVICE`,70,91);
    for(const zone of zones){c.fillStyle=zone.code.startsWith('N')?'#254653':zone.code.startsWith('S')?'#443c30':'#24343a';c.fillRect(px(zone.x-zone.w/2),pz(zone.z-zone.d/2),zone.w*scale,zone.d*scale);}
    c.strokeStyle='#ffffff0b';c.lineWidth=1;
    for(let x=-28;x<=28;x+=2){c.beginPath();c.moveTo(px(x),pz(-18));c.lineTo(px(x),pz(18));c.stroke();}
    for(let z=-18;z<=18;z+=2){c.beginPath();c.moveTo(px(-28),pz(z));c.lineTo(px(28),pz(z));c.stroke();}
    for(const b of boxes){c.fillStyle=b.h>=3.9?'#a1b4b9':b.h>=1.5?'#597b88':'#9b895c';c.fillRect(px(b.minX),pz(b.minZ),b.w*scale,b.d*scale);}
    for(const [side,points] of Object.entries(spawns))for(const [i,p] of points.entries()){
      c.fillStyle=side==='attack'?'#75d4e8':'#efa97a';c.beginPath();c.arc(px(p.x),pz(p.z),10,0,Math.PI*2);c.fill();c.font='bold 15px Arial';c.fillText(`${side==='attack'?'A':'D'}${i+1}`,px(p.x)+15,pz(p.z)+5);
    }
    c.strokeStyle='#e7d589';c.lineWidth=3;c.beginPath();c.arc(px(objective.x),pz(objective.z),objective.radius*scale,0,Math.PI*2);c.stroke();
    c.fillStyle='#f1df99';c.font='bold 18px Arial';c.fillText('CORE',px(objective.x)-25,pz(objective.z)+7);
    c.fillStyle='#b5d7de';c.font='bold 19px Arial';c.fillText('NORTH / FREIGHT',px(-6),pz(-17));c.fillStyle='#dfc2a3';c.fillText('SOUTH / SERVICE',px(-6),pz(17.3));
    c.fillStyle='#b4c4c6';c.font='17px Arial';c.fillText('Blue / Orange: spawn points    •    Pale: walls    •    Slate / Sand: high / low cover',70,994);
    return canvas.toDataURL('image/png');
  },{map:MAP,boxes:BOXES,spawns:SPAWNS,objective:OBJECTIVE,zones:ZONES});
  writeFileSync('artifacts/map-overview.png',Buffer.from(overview.split(',')[1],'base64'));
  const showcase=await page.evaluate(()=>{
    const v=window.__BLA.view,scene=new v.scene.constructor();scene.background=v.scene.background.clone().set(0x27322f);scene.environment=v.environment;scene.environmentIntensity=.8;
    const ambient=v.scene.children.find(o=>o.isHemisphereLight).clone();ambient.intensity=2.2;scene.add(ambient);
    const key=v.sun.clone();key.castShadow=true;key.position.set(-3,5,-4);key.intensity=3;key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.camera.updateProjectionMatrix();scene.add(key);
    const groundMaterial=v.materials.concrete.clone();groundMaterial.map=null;groundMaterial.normalMap=null;groundMaterial.roughnessMap=null;groundMaterial.color.setHex(0x303b36);
    const ground=v.kit.box(scene,200,.05,200,0,-.04,0,groundMaterial);ground.castShadow=false;
    const rim=key.clone();rim.position.set(3,3,2);rim.intensity=2;scene.add(rim);
    const camera=v.camera.clone();camera.fov=36;camera.aspect=1440/900;camera.position.set(1.4,1.4,-3.9);camera.lookAt(0,.97,0);camera.updateProjectionMatrix();
    const actors=[v.characters.create(0,'SENTINEL / FIELD'),v.characters.create(1,'SENTINEL / URBAN')];
    for(const [i,actor] of actors.entries()){
      actor.position.x=i===0?-.52:.52;actor.userData.marker.visible=false;scene.add(actor);
      v.characters.animate(actor,{x:actor.position.x,y:0,z:0,alive:true,weapon:'rifle',pitch:0,crouch:false,sprinting:false,cooldown:0},0);
    }
    v.renderer.render(scene,camera);const front=v.renderer.domElement.toDataURL('image/png'),calls=v.renderer.info.render.calls;
    camera.position.set(-1.5,1.5,4.5);camera.lookAt(0,1.03,0);v.renderer.render(scene,camera);const back=v.renderer.domElement.toDataURL('image/png');
    camera.position.set(-3.8,1.3,-.2);camera.lookAt(-.52,1.06,0);v.renderer.render(scene,camera);const profile=v.renderer.domElement.toDataURL('image/png');
    camera.position.set(.33,1.7,-1.65);camera.lookAt(-.51,1.48,-.01);v.renderer.render(scene,camera);const closeup=v.renderer.domElement.toDataURL('image/png');
    v.characters.animate(actors[1],{x:.52,y:0,z:0,alive:true,weapon:'rifle',pitch:0,crouch:true,sprinting:false,cooldown:0},0);
    camera.position.set(1.4,1.4,-3.9);camera.lookAt(0,.97,0);v.renderer.render(scene,camera);const crouch=v.renderer.domElement.toDataURL('image/png');
    const poses=[];
    for(const weapon of ['rifle','pistol','scatter','smg','dmr','lmg','sniper'])for(const pitch of [-.35,0,.35])for(const crouch of [false,true]){
      const actor=actors[0],u=actor.userData;
      v.characters.animate(actor,{x:-.52,y:0,z:0,alive:true,weapon,pitch,crouch,sprinting:false,cooldown:0},0);
      const vec=()=>camera.position.clone().set(0,0,0);
      const support=weapon==='pistol'?[-.065,-.115,.07]:[-.072,-.105,weapon==='sniper'?-.32:weapon==='lmg'?-.31:-.29];
      const targets=[support,[.054,-.1,weapon==='pistol'?.07:.135]];
      poses.push({weapon,pitch,crouch,errors:u.arms.map((arm,i)=>{
        const target=u.aim.localToWorld(vec().fromArray(targets[i]).multiplyScalar(.78));
        return arm.hand.getWorldPosition(vec()).distanceTo(target);
      })});
    }
    const result={front,back,profile,closeup,crouch,poses,calls,triangles:actors.map(actor=>{let n=0;actor.userData.skin.traverse(o=>{if(o.isSkinnedMesh)n+=o.geometry.attributes.position.count/3;});return n;}),palettes:actors.map(actor=>{const result={};actor.userData.skin.traverse(o=>{if(o.isMesh)result[o.material.userData.role]=o.material.color.getHexString();});return result;})};
    for(const actor of actors){scene.remove(actor);v.characters.release(actor);}groundMaterial.dispose();return result;
  });
  writeFileSync('artifacts/original-soldiers-front.png',Buffer.from(showcase.front.split(',')[1],'base64'));
  writeFileSync('artifacts/original-soldiers-back.png',Buffer.from(showcase.back.split(',')[1],'base64'));
  writeFileSync('artifacts/original-soldier-closeup.png',Buffer.from(showcase.closeup.split(',')[1],'base64'));
  writeFileSync('artifacts/original-soldier-crouch.png',Buffer.from(showcase.crouch.split(',')[1],'base64'));
  writeFileSync('artifacts/original-soldier-profile.png',Buffer.from(showcase.profile.split(',')[1],'base64'));
  delete showcase.front;delete showcase.back;delete showcase.profile;delete showcase.closeup;delete showcase.crouch;
  const misplacedHands=showcase.poses.filter(p=>p.errors.some((error,i)=>!Number.isFinite(error)||error>=(i===0?.03:.01)));
  assert.deepEqual(misplacedHands,[],'hands stay within 3 cm of the support grip and 1 cm of the firing grip');
  assert.notEqual(showcase.palettes[0].cloth,showcase.palettes[1].cloth,'factions use distinct uniform palettes');
  assert.ok(showcase.triangles.every(n=>n<85000),'authored character geometry stays below 85k triangles');
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
  writeFileSync('artifacts/visual-report.json',JSON.stringify({passed:true,setup,showcase,checks,errors,characterRequests},null,2));
  console.log('Visual acceptance passed: local skinned humans, independent skeletons, walk/run, weapons, three quality levels, batched scenery, bounded effects and no browser/GPU/resource errors.');
}finally{await browser?.close();await app.close();}
