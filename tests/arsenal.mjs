import { chromium } from '@playwright/test';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.js';
import { WEAPON_ORDER,WEAPONS } from '../src/shared/data.js';

mkdirSync('artifacts',{recursive:true});
const app=await createServer({production:true,port:0,host:'127.0.0.1'});
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try{
  browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--enable-unsafe-swiftshader','--disable-gpu-sandbox',`--explicitly-allowed-ports=${app.server.address().port}`]});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${app.server.address().port}/?debug=1`);await page.waitForFunction(()=>window.__BLA);
  await page.getByRole('button',{name:'装备库',exact:true}).click();
  for(const type of WEAPON_ORDER.filter(t=>t!=='pistol')){
    await page.locator(`[data-group="primary"] [data-value="${type}"]`).click();
    assert.equal(await page.locator('#inspect-name').textContent(),WEAPONS[type].name);
  }
  const preview=page.locator('#weapon-preview'),bounds=await preview.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.4,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.55,{steps:10});await page.mouse.up();
  await page.screenshot({path:'artifacts/arsenal-menu.png'});
  await page.setViewportSize({width:1280,height:720});
  const sniperCard=await page.locator('[data-value="sniper"]').boundingBox();assert.ok(sniperCard.y>=0&&sniperCard.y+sniperCard.height<=720,'all six primary cards fit at 720p');
  await page.screenshot({path:'artifacts/arsenal-menu-720p.png'});await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'返回行动部署 →'}).first().click();await page.locator('#start-offline').click();
  await page.waitForFunction(()=>window.__BLA.state?.actors[0].weapon==='sniper');
  await page.locator('#ready').click();await page.waitForFunction(()=>window.__BLA.state.phase==='combat');
  // Stop AI so real keyboard / mouse checks are independent of the firefight.
  await page.evaluate(()=>{
    const g=window.__BLA,m=g.match;m.remaining=999;
    for(const [i,a] of m.actors.entries()){a.bot=false;Object.assign(a,{x:i===0?6:14,z:i===0?1:-8,hp:100});m.setInput(a.id,{yaw:a.yaw});}
    g.resume();
  });
  await page.locator('#view').click({position:{x:700,y:450}});await page.waitForFunction(()=>!!document.pointerLockElement);
  const shots=[];
  for(const [i,type] of WEAPON_ORDER.entries()){
    await page.keyboard.press(`Digit${i+1}`);
    await page.waitForFunction(type=>{const g=window.__BLA,p=g.state.actors[0];return p.weapon===type&&p.switchTime===0&&p.cooldown===0;},type);
    const before=await page.evaluate(type=>window.__BLA.state.actors[0].ammo[type].mag,type);
    await page.mouse.down();await page.waitForTimeout(170);await page.mouse.up();
    await page.waitForFunction(({type,before})=>window.__BLA.state.actors[0].ammo[type].mag<before,{type,before});
    const check=await page.evaluate(type=>{const g=window.__BLA,p=g.state.actors[0];return {type,mag:p.ammo[type].mag,model:g.view.weapon.userData.design,muzzle:g.view.weapon.userData.muzzle.toArray(),errors:g.errors};},type);
    assert.ok(check.model);assert.ok(check.muzzle[2]<-.3);assert.deepEqual(check.errors,[]);
    shots.push(check);
    if(['smg','dmr','lmg','sniper'].includes(type))await page.screenshot({path:`artifacts/arsenal-${type}.png`});
  }
  await page.mouse.down({button:'right'});
  await page.waitForSelector('#scope-overlay:not([hidden])');
  await page.waitForFunction(()=>window.__BLA.view.camera.fov<25);
  assert.equal(await page.evaluate(()=>window.__BLA.view.weaponPass.enabled),false);
  assert.equal(await page.locator('#crosshair').isVisible(),false);
  await page.screenshot({path:'artifacts/arsenal-sniper-scope.png'});
  await page.mouse.up({button:'right'});await page.waitForSelector('#scope-overlay[hidden]',{state:'attached'});
  await page.mouse.wheel(0,120);await page.waitForFunction(()=>window.__BLA.state.actors[0].weapon==='rifle');
  await page.mouse.wheel(0,-120);await page.waitForFunction(()=>window.__BLA.state.actors[0].weapon==='sniper');
  const retained=await page.evaluate(()=>({rifle:window.__BLA.state.actors[0].ammo.rifle.mag,sniper:window.__BLA.state.actors[0].ammo.sniper.mag}));
  assert.equal(retained.rifle,shots[0].mag);assert.equal(retained.sniper,shots.at(-1).mag);
  // Check the low-power optic also has the correct magnification and HUD.
  await page.keyboard.press('Digit5');await page.waitForFunction(()=>window.__BLA.state.actors[0].weapon==='dmr'&&window.__BLA.state.actors[0].switchTime===0);
  await page.mouse.down({button:'right'});await page.waitForSelector('#scope-overlay:not([hidden])');assert.match(await page.locator('#scope-label').textContent(),/2.25/);await page.mouse.up({button:'right'});
  assert.deepEqual(errors,[]);
  writeFileSync('artifacts/arsenal-report.json',JSON.stringify({passed:true,shots,retained,errors},null,2));
  console.log('Arsenal acceptance passed: six primary previews, seven keyboard slots and firing, wheel wraparound, independent ammo, 5x sniper / 2.25x DMR scopes, screenshots and no browser errors.');
}finally{await browser?.close();await app.close();}
