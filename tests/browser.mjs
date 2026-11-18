import { launchBrowser, waitForGame } from './browser-utils.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from './app.mjs';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({production:true,port:0,host:'127.0.0.1'});
const base=`http://127.0.0.1:${app.server.address().port}`;
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>existsSync(p));
let browser;
try {
  browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem('storage-regression-checked')){
      localStorage.setItem('bla.settings','null');localStorage.setItem('bla.connections','null');
      sessionStorage.setItem('storage-regression-checked','true');
    }
  });
  await page.goto(`${base}/?debug=1`);await waitForGame(page);await page.waitForTimeout(600);
  await page.screenshot({path:'artifacts/menu.png'});
  await page.getByRole('button',{name:'装备库',exact:true}).click();await page.locator('[data-group="primary"] [data-value="scatter"]').click();
  await page.getByRole('button',{name:'返回行动部署 →'}).first().click();
  await page.locator('[data-group="mode"] [data-value="core"]').click();
  await page.locator('#start-offline').click();await page.waitForSelector('#prepare-panel:not([hidden])');
  assert.equal(await page.evaluate(()=>window.__BLA.state.actors.length),6);
  assert.equal(await page.evaluate(()=>window.__BLA.state.actors.find(a=>a.id==='player').weapon),'scatter');
  await page.locator('[data-loadout="rifle"]').click();await page.locator('#ready').click();
  await page.waitForFunction(()=>window.__BLA.state.phase==='combat');await page.locator('#view').click({position:{x:700,y:500}});
  await page.waitForFunction(()=>window.__BLA.view.recoil===0);
  // Exercise the pointer-lock listener and compare the rendered view with authoritative aim.
  const look=async movementY=>page.evaluate(async movementY=>{
    const g=window.__BLA,camera=g.view.camera;
    const before=camera.getWorldDirection(camera.position.clone()).y;
    assertLocked();
    window.dispatchEvent(new MouseEvent('mousemove',{movementY}));
    const actor=g.match.actors.find(a=>a.id===g.playerId);
    for(let frame=0;frame<120;frame++){
      await new Promise(resolve=>requestAnimationFrame(resolve));
      if(frame>0&&Math.abs(actor.pitch-camera.rotation.x)<1e-6&&g.view.recoil===0)break;
    }
    const actual=camera.getWorldDirection(camera.position.clone());
    const expected={x:-Math.sin(actor.yaw)*Math.cos(actor.pitch),y:Math.sin(actor.pitch),z:-Math.cos(actor.yaw)*Math.cos(actor.pitch)};
    return {before,after:actual.y,pitch:actor.pitch,yaw:actor.yaw,recoil:g.view.recoil,actual:actual.toArray(),alignment:actual.x*expected.x+actual.y*expected.y+actual.z*expected.z};
    function assertLocked(){if(!document.pointerLockElement)throw new Error('Mouse look requires pointer lock');}
  },movementY);
  const up=await look(-80);assert.ok(up.after>up.before+.05,'moving mouse up looks up');assert.ok(up.alignment>.99999,`rendered view matches upward shot direction: ${JSON.stringify(up)}`);
  const down=await look(160);assert.ok(down.after<down.before-.05,'moving mouse down looks down');assert.ok(down.alignment>.99999,`rendered view matches downward shot direction: ${JSON.stringify(down)}`);
  await look(-80);
  const before=await page.evaluate(()=>{const p=window.__BLA.match.actors[0];return {x:p.x,z:p.z};});
  await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
  const after=await page.evaluate(()=>{const p=window.__BLA.match.actors[0];return {x:p.x,z:p.z};});
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.3,'keyboard movement works');
  await page.mouse.down();await page.waitForTimeout(150);await page.mouse.up();
  assert.ok(await page.evaluate(()=>window.__BLA.match.actors[0].ammo.rifle.mag<24),'mouse firing consumes ammo');
  await page.keyboard.press('F1');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__BLA.state.orders[0]?.type),'follow');
  await page.keyboard.down('Tab');await page.waitForSelector('#scoreboard:not([hidden])');await page.keyboard.up('Tab');
  await page.screenshot({path:'artifacts/combat.png'});
  await page.keyboard.press('Escape');await page.waitForSelector('#pause:not([hidden])');
  const pauseTime=await page.evaluate(()=>window.__BLA.match.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__BLA.match.time),pauseTime,'offline pause freezes rules');
  await page.locator('#pause-settings').click();await page.locator('input[name="fov"]').fill('93');await page.locator('#settings .close-dialog').click();
  assert.equal(await page.evaluate(()=>window.__BLA.settings.fov),93);
  // Exercise end-of-life and full match UI using the production rules, with test-only debug access.
  await page.evaluate(()=>{const g=window.__BLA,m=g.match,p=m.actors[0],enemy=m.actors.find(a=>a.squad!==p.squad);m.damage(p,200,enemy);g.resume();});
  await page.waitForSelector('#spectator:not([hidden])');
  await page.evaluate(()=>{const m=window.__BLA.match;m.scores[0]=m.rules.wins-1;m.endRound(0,'浏览器验收：完成比赛');});
  await page.waitForSelector('#result:not([hidden])');assert.match(await page.locator('#result-title').textContent(),/行动胜利/);
  await page.screenshot({path:'artifacts/result.png'});await page.locator('#result-menu').click();await page.waitForSelector('#menu:not([hidden])');
  await page.reload();await waitForGame(page);assert.equal(await page.evaluate(()=>window.__BLA.settings.fov),93);
  // Verify a normal URL has no debug API and deploys directly into captured mouse controls.
  const normal=await context.newPage();normal.on('pageerror',e=>errors.push(e.message));
  await normal.goto(base);await normal.waitForSelector('#boot[hidden]',{state:'attached',timeout:60000});assert.equal(await normal.evaluate(()=>typeof window.__BLA),'undefined');
  await normal.locator('#start-offline').click();await normal.locator('#ready').click();
  await normal.waitForFunction(()=>document.querySelector('#phase-label').textContent==='战斗阶段');
  assert.ok(await normal.evaluate(()=>!!document.pointerLockElement));assert.equal(await normal.locator('#pause').isVisible(),false);await normal.close();
  // Two real browser clients run with 60 ms delay in each direction.
  let holdInputs=false;const heldInputs=[],connections=[];
  await context.routeWebSocket('**/lan',route=>{
    const upstream=route.connectToServer(),timers=new Set();
    connections.push({route,upstream});
    const later=(destination,message)=>{const timer=setTimeout(()=>{timers.delete(timer);destination.send(message);},60);timers.add(timer);};
    route.onMessage(message=>{
      if(holdInputs&&JSON.parse(String(message)).type==='input')heldInputs.push(()=>later(upstream,message));
      else later(upstream,message);
    });
    upstream.onMessage(message=>later(route,message));
    const clear=()=>{for(const timer of timers)clearTimeout(timer);timers.clear();};
    route.onClose(()=>{clear();upstream.close();});upstream.onClose(()=>{clear();route.close();});
  });
  const guest=await context.newPage();guest.on('pageerror',e=>errors.push(e.message));await guest.goto(`${base}/?debug=1`);await waitForGame(guest);
  await page.locator('#open-lan').click();await page.locator('#create-room').click();await page.waitForSelector('#lobby-code:not(:empty)');
  const code=await page.locator('#lobby-code').textContent();await guest.locator('#open-lan').click();
  const listedRoom=guest.locator('#room-list li').filter({hasText:code});
  await listedRoom.getByRole('button',{name:'加入',exact:true}).click();
  await guest.waitForSelector('#lobby-code:not(:empty)');await page.waitForFunction(()=>document.querySelectorAll('.lobby-player').length===2);
  await guest.locator('#join-bravo').click();await page.locator('#launch-room').click();
  await page.waitForFunction(()=>window.__BLA.state?.actors.some(a=>!a.bot&&a.squad===1));await guest.waitForFunction(()=>window.__BLA.state?.phase==='preparation');
  await page.locator('#ready').click();await guest.locator('#ready').click();
  await page.waitForFunction(()=>window.__BLA.state.phase==='combat');await guest.waitForFunction(()=>window.__BLA.state.phase==='combat');
  assert.equal(await page.evaluate(()=>window.__BLA.state.actors.filter(a=>!a.bot).length),2);
  await page.bringToFront();await page.evaluate(()=>window.__BLA.resume());
  holdInputs=true;await page.keyboard.down('KeyW');
  let movement;
  try{
    await page.waitForFunction(()=>{
      const g=window.__BLA,a=g.state.actors.find(a=>a.id===g.playerId),p=g.networkMovement.predicted;
      return Math.hypot(p.x-a.x,p.z-a.z)>.08;
    });
    movement=await page.evaluate(()=>{
      const g=window.__BLA,a=g.state.actors.find(a=>a.id===g.playerId),p=g.networkMovement.predicted,c=g.view.camera.position;
      return {sequence:g.networkMovement.sequence,prediction:Math.hypot(p.x-a.x,p.z-a.z),camera:Math.hypot(c.x-a.x,c.z-a.z)};
    });
    assert.ok(movement.prediction>.08,'keyboard movement is predicted while input packets are held');
    assert.ok(movement.camera>.04,'the rendered camera follows predicted movement');
  }finally{
    await page.keyboard.up('KeyW');holdInputs=false;for(const release of heldInputs.splice(0))release();
  }
  await page.waitForFunction(sequence=>{
    const g=window.__BLA;return g.state.inputAcks[g.playerId]>=sequence;
  },movement.sequence);
  await page.waitForFunction(()=>{
    const g=window.__BLA,a=g.state.actors.find(a=>a.id===g.playerId),p=g.networkMovement.predicted;
    return Math.hypot(p.x-a.x,p.z-a.z)<.03;
  });
  await page.screenshot({path:'artifacts/lan.png'});await guest.close();await page.waitForFunction(()=>window.__BLA.state.actors.filter(a=>!a.bot).length===1);
  const currentMatch=await page.evaluate(()=>({session:window.__BLA.state.session,round:window.__BLA.state.round}));
  const late=await context.newPage({viewport:{width:390,height:720}});late.on('pageerror',e=>errors.push(e.message));
  await late.goto(`${base}/?debug=1`);await waitForGame(late);await late.locator('#open-lan').click();
  const activeRoom=late.locator('#room-list li').filter({hasText:code});
  await activeRoom.getByText('战斗阶段',{exact:true}).waitFor();
  await activeRoom.scrollIntoViewIfNeeded();
  assert.ok(await activeRoom.evaluate(row=>row.scrollWidth<=row.clientWidth),'the room row fits a narrow viewport');
  await late.screenshot({path:'artifacts/room-list-390.png'});
  await activeRoom.getByRole('button',{name:'加入',exact:true}).click();
  await late.waitForFunction(({session,round})=>{
    const g=window.__BLA;return g.state?.session===session&&g.state.round===round&&g.state.actors.some(a=>!a.bot&&a.id===g.playerId);
  },currentMatch);
  await page.waitForFunction(()=>window.__BLA.state.actors.filter(a=>!a.bot).length===2);
  await late.close();await page.waitForFunction(()=>window.__BLA.state.actors.filter(a=>!a.bot).length===1);
  await page.bringToFront();
  await page.evaluate(()=>document.querySelector('#view').requestPointerLock());
  await page.waitForFunction(()=>!!document.pointerLockElement);
  connections[0].upstream.close();connections[0].route.close();
  await page.waitForFunction(()=>document.querySelector('#pause-title').textContent==='连接已断开');
  assert.equal(await page.evaluate(()=>!!document.pointerLockElement),false,'disconnect releases the captured mouse');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pause').isVisible(),true,'Escape cannot resume a disconnected match');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('#pause-title').textContent(),'连接已断开','blur preserves the disconnect reason');
  assert.equal(await page.locator('#resume').isDisabled(),true);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__BLA.errors),[]);
  await page.setViewportSize({width:1280,height:720});await page.locator('#quit').click();await page.screenshot({path:'artifacts/menu-720p.png'});
  await page.locator('#start-offline').click();assert.equal(await page.locator('#resume').isDisabled(),false,'offline play works after leaving a disconnected match');
  writeFileSync('artifacts/browser-report.json',JSON.stringify({passed:true,errors,screenshots:['menu','combat','result','lan','menu-720p'],checks:['null stored preferences do not prevent startup','disconnect releases pointer lock and cannot be resumed','offline play after disconnect','menu/loadout','mouse look up/down and shot alignment','movement','firing','team orders','scoreboard','offline pause','settings persistence','spectate','match result','two browser LAN clients with 120 ms round trip','room list and late join into the same match','local keyboard and camera prediction before server input delivery','acknowledged movement reconciliation','disconnect bot takeover']},null,2));
  console.log('Browser acceptance passed: menu, combat, results, persistence and two-client LAN. Screenshots: artifacts/');
} finally {await browser?.close();await app.close();}
