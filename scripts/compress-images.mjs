import { chromium } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const root='public/art',backupRoot='artifacts/image-originals',files=[];
function collect(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())collect(file);else if(file.endsWith('.webp'))files.push(file);}}
collect(root);
const manifestPaths=['public/art/manifest.json','public/art/characters/manifest.json'];
const manifests=manifestPaths.map(file=>({file,data:JSON.parse(readFileSync(file,'utf8'))}));
const assets=new Map();for(const {data} of manifests)for(const asset of Object.values(data.assets))for(const channel of Object.values(asset.channels))assets.set(path.normalize('public'+channel.url),{channel,tileable:asset.tileable});
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})}),report=[];
try{
  const page=await browser.newPage();
  for(const file of files){
    const backup=path.join(backupRoot,path.relative(root,file));mkdirSync(path.dirname(backup),{recursive:true});
    if(!existsSync(backup))copyFileSync(file,backup);
    const source=readFileSync(backup),current=readFileSync(file),record=assets.get(path.normalize(file));
    const kind=/normal|nor_gl/.test(file)?'normal':/rough/.test(file)?'roughness':'albedo';
    const result=await page.evaluate(async({source,kind,tileable})=>{
      const image=new Image();image.src='data:image/webp;base64,'+source;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const original=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const decoded=document.createElement('canvas');decoded.width=canvas.width;decoded.height=canvas.height;const dc=decoded.getContext('2d',{willReadFrequently:true});
      const qualities=kind==='normal'?[.94,.97,.99]:kind==='roughness'?[.85,.9,.95]:[.85,.9,.94];
      for(const quality of qualities){
        const url=canvas.toDataURL('image/webp',quality),candidate=new Image();candidate.src=url;await candidate.decode();
        dc.clearRect(0,0,canvas.width,canvas.height);dc.drawImage(candidate,0,0);const pixels=dc.getImageData(0,0,canvas.width,canvas.height).data;
        let squared=0,count=0,angleSum=0;const angles=[];
        for(let i=0;i<pixels.length;i+=64){
          for(let c=0;c<3;c++){const error=pixels[i+c]-original[i+c];squared+=error*error;count++;}
          if(kind==='normal'){
            const a=[original[i]/127.5-1,original[i+1]/127.5-1,original[i+2]/127.5-1],b=[pixels[i]/127.5-1,pixels[i+1]/127.5-1,pixels[i+2]/127.5-1];
            const cosine=(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(Math.hypot(...a)*Math.hypot(...b));
            const angle=Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI;angleSum+=angle;angles.push(angle);
          }
        }
        let edgeMean=0;if(tileable){const w=canvas.width,h=canvas.height;let sum=0;for(let y=0;y<h;y++)for(let c=0;c<3;c++)sum+=Math.abs(pixels[y*w*4+c]-pixels[(y*w+w-1)*4+c]);for(let x=0;x<w;x++)for(let c=0;c<3;c++)sum+=Math.abs(pixels[x*4+c]-pixels[((h-1)*w+x)*4+c]);edgeMean=sum/(3*(w+h));}
        angles.sort((a,b)=>a-b);
        const metrics={rmse:Math.sqrt(squared/count),meanAngle:angles.length?angleSum/angles.length:0,p95Angle:angles.length?angles[Math.floor(angles.length*.95)]:0,edgeMean};
        const acceptable=kind==='normal'?metrics.meanAngle<=2&&metrics.p95Angle<=6:metrics.rmse<=(kind==='roughness'?3:6)&&(!tileable||edgeMean<4.8);
        if(acceptable)return {data:url.split(',')[1],quality,width:canvas.width,height:canvas.height,metrics};
      }
      return null;
    },{source:source.toString('base64'),kind,tileable:kind==='albedo'&&!!record?.tileable});
    let output=current,quality=null;
    if(result){const candidate=Buffer.from(result.data,'base64');if(candidate.length<current.length){output=candidate;quality=result.quality;writeFileSync(file,output);}}
    if(record)record.channel.bytes=output.length;
    const row={file:file.split(path.sep).join('/'),kind,before:source.length,after:output.length,quality,...(result?{width:result.width,height:result.height,metrics:result.metrics}:{})};report.push(row);
    console.log(`${row.file}: ${(source.length/1024).toFixed(0)} → ${(output.length/1024).toFixed(0)} KiB${quality?' (q='+quality+')':' (kept)'}`);
  }
  for(const {file,data} of manifests)writeFileSync(file,JSON.stringify(data,null,2)+'\n');
  const before=report.reduce((s,r)=>s+r.before,0),after=report.reduce((s,r)=>s+r.after,0);
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/image-compression-report.json',JSON.stringify({before,after,saved:before-after,files:report},null,2)+'\n');
  console.log(`WebP total: ${(before/1048576).toFixed(2)} → ${(after/1048576).toFixed(2)} MiB (${((1-after/before)*100).toFixed(1)}% smaller). Dimensions retained; HDR preserved.`);
}finally{await browser.close();}
