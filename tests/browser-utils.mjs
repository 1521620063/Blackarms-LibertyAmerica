import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const executablePath=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
export const browserOptions={headless:true,...(executablePath?{executablePath}:{}),args:['--enable-unsafe-webgpu','--disable-gpu-sandbox']};
export const launchBrowser=()=>chromium.launch(browserOptions);
export async function waitForGame(page){
  await page.waitForFunction(()=>window.__BLA||!document.getElementById('fatal').hidden,null,{timeout:60000});
  const fatal=await page.locator('#fatal').textContent();
  if(fatal)throw new Error(fatal);
  await page.waitForFunction(()=>window.__BLA.view.renderer.info.render.frameCalls>0);
}
