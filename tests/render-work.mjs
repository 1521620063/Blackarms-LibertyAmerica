import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createFrontendServer } from '../frontend/server.mjs';
import { launchBrowser, waitForGame } from './browser-utils.mjs';

const app=await createFrontendServer({production:true,port:0,host:'127.0.0.1',tls:false});
const browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);await waitForGame(page);
  assert.match(await page.title(),/BLACKARMS/i);
  assert.ok(await page.locator('#start-offline').isVisible());
  await page.locator('#start-offline').click();await page.locator('#ready').click();
  await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  await page.evaluate(()=>{const g=window.__BLA;g.pause();g.view.renderer.setAnimationLoop(null);});
  const pools=await page.evaluate(()=>{
    const v=window.__BLA.view,fx=v.fx;
    const snapshot=()=>({particles:fx.smoke.geometry.instanceCount,shells:fx.casings.count,
      visible:[fx.smoke.mesh.visible,fx.casings.visible],
      uploads:[fx.smoke.geometry.attributes.alpha.version,fx.casings.instanceMatrix.version]});
    const emit=()=>{
      const origin={x:0,y:1,z:0};
      fx.smoke.emit(origin,{x:0,y:1,z:0},0xffffff,.2,.1);
      fx.shell(v.camera.position,{x:1,y:0,z:0},{x:0,y:0,z:1});
      fx.update(0);return snapshot();
    };
    fx.clear();const empty=snapshot();fx.update(1/60);const idle=snapshot();
    const active=emit();fx.update(3);const expired=snapshot();
    const reused=emit();fx.clear();return {empty,idle,active,expired,reused,cleared:snapshot()};
  });
  assert.deepEqual(pools.empty,pools.idle,'empty pools never upload buffers');
  for(const sample of [pools.empty,pools.expired,pools.cleared]){
    assert.equal(sample.particles+sample.shells,0);
    assert.deepEqual(sample.visible,[false,false]);
  }
  for(const sample of [pools.active,pools.reused]){
    assert.equal(sample.particles,1);assert.equal(sample.shells,1);
    assert.deepEqual(sample.visible,[true,true]);
  }
  const checks=[];
  for(const {viewport,quality} of [{width:1920,height:1080},{width:2560,height:1440}].flatMap(viewport=>['high','medium','low','high'].map(quality=>({viewport,quality})))){
    await page.setViewportSize(viewport);
    // Let the browser's resize event finish before measuring shadow cadence.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const result=await page.evaluate(async quality=>{
      const g=window.__BLA,v=g.view;g.settings.quality=quality;v.resize();
      const draw=(time)=>{
        v.renderer._nodes.nodeFrame.update();
        v.render(g.state,g.playerId,1/60,time);
      };
      draw(30);await v.renderer.backend.device.queue.onSubmittedWorkDone();
      const lights=[v.sun,v.gunLight,...v.localShadowLights],updates=lights.map(()=>0);
      const originals=lights.map((light,index)=>{
        const original=light.shadow.updateMatrices;
        light.shadow.updateMatrices=function(...args){updates[index]++;return original.apply(this,args);};
        return original;
      });
      try{
        const self=v.models.get(g.playerId),other=[...v.models.values()].find(model=>model.visible);
        const selfBefore=self.userData.mixer.time,otherBefore=other.userData.mixer.time;
        v.sunShadowElapsed=0;
        const perFrame=[];
        for(let frame=0;frame<12;frame++){
          const before=[...updates];
          draw(30.1+frame/60);await v.renderer.backend.device.queue.onSubmittedWorkDone();
          perFrame.push(updates.map((count,index)=>count-before[index]));
        }
        const volume=v.atmosphere.scatteringPass?.renderTarget,reflection=v.wetFloor.getRenderTarget();
        return {quality,updates,perFrame,steps:v.atmosphere.steps.value,mipmaps:v.wetFloor.userData.reflection.reflector.generateMipmaps,hiddenPoseDelta:self.userData.mixer.time-selfBefore,visiblePoseDelta:other.userData.mixer.time-otherBefore,reflection:v.wetFloor.visible?{width:reflection.width,height:reflection.height}:null,volume:volume?{width:volume.width,height:volume.height}:null,width:v.renderer.domElement.width,height:v.renderer.domElement.height,active:v.atmosphere.bindings.map(binding=>binding.active.value),localLights:[...v.localLights,...v.lightPool].filter(light=>light.visible).length,geometryReduced:v.facilityDetail.every(({mesh,full,simple})=>mesh.geometry===(quality==='high'?full:simple)&&simple.attributes.position.count<full.attributes.position.count)};
      }finally{lights.forEach((light,index)=>light.shadow.updateMatrices=originals[index]);}
    },quality);
    checks.push({viewport,...result});
  }
  mkdirSync('artifacts',{recursive:true});
  console.log(checks);
  for(const check of checks){
    assert.equal(check.hiddenPoseDelta,0,'the hidden first-person body skips skeletal animation and IK');
    assert.ok(check.visiblePoseDelta>0,'visible actors keep animating');
    assert.ok(check.perFrame.every(updates=>updates.every(count=>count<=1)),`${check.quality}: each shadow map is rendered at most once per frame, including reflections: ${check.updates}`);
    assert.ok(check.geometryReduced,'geometry detail matches the selected quality');
    if(check.quality!=='high')assert.equal(check.reflection,null,'only high rerenders the scene for planar reflections');
    if(check.quality==='low'){
      assert.deepEqual(check.updates,[0,0,0,0]);
      assert.equal(check.localLights,6,'low quality uses a fixed pool of nearby lights');
      assert.ok(check.width*check.height<=960*540);
    }else{
      assert.equal(check.localLights,check.quality==='high'?26:8,'medium limits unshadowed lamps while high keeps the full set');
      assert.equal(check.updates[0],check.quality==='high'?6:4,'sun shadows update at 30/20 Hz during 60 Hz rendering');
      assert.equal(check.updates[1],12,'weapon shadows still follow every animation frame');
      assert.deepEqual(check.updates.slice(2),check.quality==='high'?[12,12]:[12,0],'active local shadows update once per frame');
      assert.equal(check.active[0],1,'cached shadow maps remain active for volumetric light');
      assert.equal(check.steps,check.quality==='high'?20:16,'volumetric sample count scales with quality');
      assert.ok(check.volume,'volumetric scattering has an independent render target');
      const budget=check.quality==='high'?640*360:480*270;
      assert.ok(check.volume.width*check.volume.height<=Math.min(budget,check.width*check.height/16),'ray marching stays within its pixel budget at 1080p and 1440p');
      if(check.quality==='high'){
        assert.ok(check.reflection.width*check.reflection.height<=budget,'actual reflection attachment stays within its pixel budget');
        assert.equal(check.width,check.viewport.width,'high quality preserves native scene width');
        assert.equal(check.height,check.viewport.height,'high quality preserves native scene height');
      }
      assert.equal(check.mipmaps,false,'ripples do not generate a reflection mip chain');
    }
  }
  const spectator=await page.evaluate(async()=>{
    const g=window.__BLA,v=g.view,actor=g.state.actors.find(actor=>actor.id===g.playerId),self=v.models.get(g.playerId);
    actor.x+=.1;v.render(g.state,g.playerId,1/60,31);
    const moving=self.userData.speed>0&&v.moveBlend>0,before=self.userData.mixer.time;
    const teammate=g.state.actors.find(other=>other.id!==g.playerId);
    v.render(g.state,g.playerId,1/60,31.1,{spectate:teammate.id});
    await v.renderer.backend.device.queue.onSubmittedWorkDone();
    return {moving,resumed:self.userData.mixer.time>before,visible:self.visible};
  });
  assert.ok(spectator.moving,'hidden actors still drive first-person weapon bob');
  assert.ok(spectator.resumed&&spectator.visible,'switching spectator resumes the previously hidden body animation');
  const culling=await page.evaluate(async()=>{
    const v=window.__BLA.view,actor=[...v.models.values()].find(model=>model.visible),skins=[];
    for(const model of v.models.values())model.visible=model===actor;
    actor.position.set(0,0,0);actor.updateMatrixWorld(true);
    actor.userData.skin.traverse(mesh=>{if(mesh.isSkinnedMesh)skins.push(mesh);});
    let color=0,shadows=0;
    for(const mesh of skins){mesh.onBeforeRender=()=>color++;mesh.onBeforeShadow=()=>shadows++;}
    v.weaponPass.enabled=false;v.weaponVisible.value=0;
    const draw=async(target)=>{
      color=0;shadows=0;v.camera.position.set(-8,1.5,0);v.camera.lookAt(...target);
      v.sun.shadow.needsUpdate=true;
      v.camera.updateMatrixWorld(true);v.atmosphere.update();v.renderer._nodes.nodeFrame.update();v.composer.render();
      // WebGPU also calls onBeforeRender for shadow submissions.
      await v.renderer.backend.device.queue.onSubmittedWorkDone();return {color:color-shadows,shadows};
    };
    try{return {away:await draw([-20,1.5,0]),towards:await draw([0,1,0])};}
    finally{for(const mesh of skins){mesh.onBeforeRender=()=>{};mesh.onBeforeShadow=()=>{};}}
  });
  console.log({culling});
  assert.equal(culling.away.color,0,'offscreen bodies are culled in the world and reflection color passes');
  assert.ok(culling.away.shadows>0,'offscreen actors still cast shadows into the scene');
  assert.ok(culling.towards.color>0,'turning back restores the body without a simulation update');
  const bounds=await page.evaluate(()=>{
    const g=window.__BLA,v=g.view,sides=new Set();let checked=0,outside=0;
    for(const [id,model] of v.models){
      if(sides.has(model.userData.side))continue;sides.add(model.userData.side);model.visible=true;
      const actor=g.state.actors.find(actor=>actor.id===id),point=model.position.clone();
      for(const pose of [{alive:true},{alive:true,crouch:true,pitch:1},{alive:true,sprinting:true,pitch:-1},{alive:false}]){
        for(let frame=0;frame<12;frame++)v.characters.animate(model,{...actor,...pose,x:frame*.05,z:0},1/30);
        model.updateMatrixWorld(true);
        model.userData.skin.traverse(mesh=>{
          if(!mesh.isSkinnedMesh)return;
          const count=mesh.geometry.attributes.position.count;
          for(let index=0;index<count;index+=47){
            mesh.getVertexPosition(index,point);checked++;
            if(!mesh.boundingSphere?.containsPoint(point))outside++;
          }
        });
      }
    }
    return {factions:sides.size,checked,outside};
  });
  assert.equal(bounds.factions,2,'both faction designs are covered');
  assert.ok(bounds.checked>1000,'sample deformed vertices across walking, crouching, aiming and death');
  assert.equal(bounds.outside,0,'animated limbs remain inside the conservative culling bounds');
  writeFileSync('artifacts/render-work-report.json',JSON.stringify({checks,spectator,culling,bounds,errors},null,2));
  await page.screenshot({path:'artifacts/render-work-high.png'});
  assert.deepEqual(errors,[]);
}finally{await browser.close();await app.close();}
