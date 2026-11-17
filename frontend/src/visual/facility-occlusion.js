import * as T from 'three';
import { BOXES, MAP } from '../game/data.js';

// Static indirect occlusion in metres, independent of the repeating floor UVs.
// This gives walls and heavy cover stable contact even outside the shadow lights.
export function bakeFacilityOcclusion(material){
  const size=512,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x+.5)/size*MAP.width-MAP.halfWidth,pz=(y+.5)/size*MAP.depth-MAP.halfDepth;
    let occlusion=0;
    for(const b of BOXES){
      const dx=Math.max(b.minX-px,0,px-b.maxX),dz=Math.max(b.minZ-pz,0,pz-b.maxZ);
      if(dx>1.4||dz>1.4)continue;
      const distance=Math.hypot(dx,dz),height=Math.min(1,b.h/1.7);
      occlusion=Math.max(occlusion,Math.exp(-distance/.3)*.72*height);
    }
    const value=Math.round(255*(1-occlusion)),i=(y*size+x)*4;data.set([value,value,value,255],i);
  }
  const texture=new T.DataTexture(data,size,size);texture.flipY=true;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;
  texture.name='facility-static-contact';texture.needsUpdate=true;
  material.aoMap=texture;material.aoMapIntensity=1;material.needsUpdate=true;
  return texture;
}
