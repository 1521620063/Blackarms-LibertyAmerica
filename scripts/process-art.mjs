import { chromium } from '@playwright/test';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ids=process.argv.slice(2).length?process.argv.slice(2):['concrete','floor','gunmetal','fabric','service-panel'];
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const output='public/art/materials';await mkdir(output,{recursive:true});await mkdir('artifacts/art-previews',{recursive:true});
const browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})});
try{
  const page=await browser.newPage();
  const manifestPath='public/art/manifest.json';let manifest={version:1,style:'Zero Facility / grounded contemporary military industrial',assets:{}};
  if(existsSync(manifestPath))manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  for(const id of ids){
    const metadata=JSON.parse(await readFile(`artifacts/ai-source/${id}.json`,'utf8')),source=await readFile(path.join('artifacts/ai-source',metadata.file));
    const result=await page.evaluate(async({id,source})=>{
      const image=new Image();image.src=`data:image/png;base64,${source}`;await image.decode();
      const sourceSize={width:image.naturalWidth,height:image.naturalHeight};
      const size=1024,tileable=id!=='service-panel',canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,size,size);
      const rgba=ctx.getImageData(0,0,size,size),data=rgba.data;
      // Normalize mean brightness and reduce saturation; lighting remains the renderer's job.
      let mean=0;for(let i=0;i<data.length;i+=4)mean+=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/(size*size);
      const target={concrete:173,floor:127,gunmetal:135,fabric:142,'service-panel':113}[id];
      const gain=target/Math.max(1,mean),saturation=id==='fabric'?.78:.55;
      for(let i=0;i<data.length;i+=4){const l=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;for(let c=0;c<3;c++)data[i+c]=Math.max(0,Math.min(255,(l+(data[i+c]-l)*saturation)*gain));data[i+3]=255;}
      if(tileable){
        // Match opposing boundaries with a local raised-cosine correction. Fine interior
        // detail remains untouched, while coarse illumination mismatches are feathered.
        const band=96;
        for(let y=0;y<size;y++)for(let c=0;c<3;c++){
          const left=data[(y*size)*4+c],right=data[(y*size+size-1)*4+c],delta=(right-left)/2;
          for(let x=0;x<band;x++){const weight=(1+Math.cos(Math.PI*x/band))/2;data[(y*size+x)*4+c]+=delta*weight;data[(y*size+size-1-x)*4+c]-=delta*weight;}
        }
        for(let x=0;x<size;x++)for(let c=0;c<3;c++){
          const top=data[x*4+c],bottom=data[((size-1)*size+x)*4+c],delta=(bottom-top)/2;
          for(let y=0;y<band;y++){const weight=(1+Math.cos(Math.PI*y/band))/2;data[(y*size+x)*4+c]+=delta*weight;data[((size-1-y)*size+x)*4+c]-=delta*weight;}
        }
        // Assign the exact shared edge after Uint8 rounding.
        for(let y=0;y<size;y++)for(let c=0;c<3;c++){const value=Math.round((data[y*size*4+c]+data[(y*size+size-1)*4+c])/2);data[y*size*4+c]=data[(y*size+size-1)*4+c]=value;}
        for(let x=0;x<size;x++)for(let c=0;c<3;c++){const value=Math.round((data[x*4+c]+data[((size-1)*size+x)*4+c])/2);data[x*4+c]=data[((size-1)*size+x)*4+c]=value;}
      }
      ctx.putImageData(rgba,0,0);
      const luminance=new Float32Array(size*size);for(let i=0;i<luminance.length;i++)luminance[i]=(data[i*4]*.2126+data[i*4+1]*.7152+data[i*4+2]*.0722)/255;
      // High-pass luminance yields subtle approximate micro-relief, never a claim of
      // physically reconstructed normals or an AI-generated calibrated PBR material.
      const smooth=new Float32Array(size*size),height=new Float32Array(size*size),r=3;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        let sum=0;for(let d=-r;d<=r;d++)sum+=luminance[y*size+(x+d+size)%size];smooth[y*size+x]=sum/(2*r+1);
      }
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        let sum=0;for(let d=-r;d<=r;d++)sum+=smooth[((y+d+size)%size)*size+x];height[y*size+x]=luminance[y*size+x]-sum/(2*r+1);
      }
      const normal=document.createElement('canvas'),roughness=document.createElement('canvas');normal.width=normal.height=roughness.width=roughness.height=size;
      const nc=normal.getContext('2d'),rc=roughness.getContext('2d'),ni=nc.createImageData(size,size),ri=rc.createImageData(size,size);
      const strength={concrete:2.4,floor:1.4,gunmetal:.8,fabric:2,'service-panel':.5}[id],rough={concrete:225,floor:180,gunmetal:175,fabric:237,'service-panel':195}[id];
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=y*size+x,p=i*4,dx=(height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size])*strength,dy=(height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x])*strength;
        const length=Math.hypot(dx,dy,1);ni.data.set([128-dx/length*127,128+dy/length*127,128+127/length,255],p);
        const value=Math.max(0,Math.min(255,rough+height[i]*75));ri.data.set([value,value,value,255],p);
      }
      nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
      const preview=document.createElement('canvas');preview.width=preview.height=1056;const pc=preview.getContext('2d');
      if(tileable)for(let y=0;y<3;y++)for(let x=0;x<3;x++)pc.drawImage(canvas,x*352,y*352,352,352);else pc.drawImage(canvas,0,0,1056,1056);
      let edgeError=0;if(tileable)for(let i=0;i<size;i++)for(let c=0;c<3;c++)edgeError=Math.max(edgeError,Math.abs(data[(i*size)*4+c]-data[(i*size+size-1)*4+c]),Math.abs(data[i*4+c]-data[((size-1)*size+i)*4+c]));
      return {sourceSize,size,tileable,edgeError,albedo:canvas.toDataURL('image/webp',.94),normal:normal.toDataURL('image/webp',.99),roughness:roughness.toDataURL('image/webp',.95),preview:preview.toDataURL('image/jpeg',.9)};
    },{id,source:source.toString('base64')});
    const files={};for(const channel of ['albedo','normal','roughness']){
      const ext='webp',file=`${id}-${channel}.${ext}`,bytes=Buffer.from(result[channel].split(',')[1],'base64');await writeFile(`${output}/${file}`,bytes);files[channel]={url:`/art/materials/${file}`,bytes:bytes.length,colorSpace:channel==='albedo'?'srgb':'linear-data'};
    }
    await writeFile(`artifacts/art-previews/${id}.jpg`,Buffer.from(result.preview.split(',')[1],'base64'));
    manifest.assets[id]={prompt:metadata.prompt,createdAt:metadata.createdAt,source:metadata.source,sourceSize:result.sourceSize,size:result.size,tileable:result.tileable,maxUncompressedEdgeDifference:result.edgeError,channels:files,processing:'Brightness normalization, restrained saturation, local edge matching for tileable maps; approximate high-frequency luminance micro-normal and conservative roughness, not measured PBR.'};
    console.log(`Processed ${id}: ${result.sourceSize.width}×${result.sourceSize.height} → ${result.size}², tileable=${result.tileable}, edge difference=${result.edgeError}`);
  }
  await writeFile(manifestPath,JSON.stringify(manifest,null,2));
}finally{await browser.close();}
