import { chromium } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';

// Fetch the original 2K JPEGs from the URLs in public/art/scanned/manifest.json
// into public/art/scanned before running this authoring-only conversion step.
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})});
try{
  const page=await browser.newPage();await page.goto('about:blank');
  for(const id of ['concrete_floor_02','concrete_wall_008'])for(const channel of ['diff','nor_gl','rough']){
    const original=`public/art/scanned/${id}-${channel}.jpg`,archived=`artifacts/scanned-sources/${id}-${channel}.jpg`,output=`public/art/scanned/${id}-${channel}.webp`;
    const input=existsSync(original)?original:archived;
    if(!existsSync(input)){if(existsSync(output))continue;throw new Error(`Missing source for ${output}; download the JPEG recorded in public/art/scanned/manifest.json`);}
    const source=`data:image/jpeg;base64,${readFileSync(input).toString('base64')}`;
    const data=await page.evaluate(async({source,channel})=>{
      const image=new Image();image.src=source;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
      canvas.getContext('2d').drawImage(image,0,0,2048,2048);
      return canvas.toDataURL('image/webp',channel==='nor_gl'?1:channel==='rough'?.96:.92).split(',')[1];
    },{source,channel});
    writeFileSync(output,Buffer.from(data,'base64'));
    if(input===original){mkdirSync('artifacts/scanned-sources',{recursive:true});renameSync(input,archived);}
  }
  console.log('Scanned material conversion complete. GPU capability is checked on the local secure origin by test:art.');
}finally{await browser.close();}
