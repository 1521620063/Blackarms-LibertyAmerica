import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.js';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({production:true,port:0,host:'127.0.0.1'});
const base=`http://127.0.0.1:${app.server.address().port}`;
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>existsSync(p));
let browser;
try {
  browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/?debug=1`);await page.waitForFunction(()=>window.__BLA);await page.waitForTimeout(600);
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
  await page.reload();await page.waitForFunction(()=>window.__BLA);assert.equal(await page.evaluate(()=>window.__BLA.settings.fov),93);
  // Verify a normal URL has no debug API and deploys directly into captured mouse controls.
  const normal=await context.newPage();normal.on('pageerror',e=>errors.push(e.message));
  await normal.goto(base);await normal.waitForSelector('#boot[hidden]',{state:'attached'});assert.equal(await normal.evaluate(()=>typeof window.__BLA),'undefined');
  await normal.locator('#start-offline').click();await normal.locator('#ready').click();
  await normal.waitForFunction(()=>document.querySelector('#phase-label').textContent==='战斗阶段');
  assert.ok(await normal.evaluate(()=>!!document.pointerLockElement));assert.equal(await normal.locator('#pause').isVisible(),false);await normal.close();
  // Two real browser clients create, join and run the authoritative LAN match.
  const guest=await context.newPage();guest.on('pageerror',e=>errors.push(e.message));await guest.goto(`${base}/?debug=1`);await guest.waitForFunction(()=>window.__BLA);
  await page.locator('#open-lan').click();await page.locator('#create-room').click();await page.waitForSelector('#lobby-code:not(:empty)');
  const code=await page.locator('#lobby-code').textContent();await guest.locator('#open-lan').click();await guest.locator('#room-code').fill(code);await guest.locator('#join-room').click();
  await guest.waitForSelector('#lobby-code:not(:empty)');await page.waitForFunction(()=>document.querySelectorAll('.lobby-player').length===2);
  await guest.locator('#join-bravo').click();await page.locator('#launch-room').click();
  await page.waitForFunction(()=>window.__BLA.state?.actors.some(a=>!a.bot&&a.squad===1));await guest.waitForFunction(()=>window.__BLA.state?.phase==='preparation');
  await page.locator('#ready').click();await guest.locator('#ready').click();
  await page.waitForFunction(()=>window.__BLA.state.phase==='combat');await guest.waitForFunction(()=>window.__BLA.state.phase==='combat');
  assert.equal(await page.evaluate(()=>window.__BLA.state.actors.filter(a=>!a.bot).length),2);
  await page.screenshot({path:'artifacts/lan.png'});await guest.close();await page.waitForFunction(()=>window.__BLA.state.actors.filter(a=>!a.bot).length===1);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__BLA.errors),[]);
  await page.setViewportSize({width:1280,height:720});await page.keyboard.press('Escape');await page.locator('#quit').click();await page.screenshot({path:'artifacts/menu-720p.png'});
  writeFileSync('artifacts/browser-report.json',JSON.stringify({passed:true,errors,screenshots:['menu','combat','result','lan','menu-720p'],checks:['menu/loadout','mouse look up/down and shot alignment','movement','firing','team orders','scoreboard','offline pause','settings persistence','spectate','match result','two browser LAN clients','disconnect bot takeover']},null,2));
  console.log('Browser acceptance passed: menu, combat, results, persistence and two-client LAN. Screenshots: artifacts/');
} finally {await browser?.close();await app.close();}
