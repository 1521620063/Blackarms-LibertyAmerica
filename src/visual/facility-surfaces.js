import * as T from 'three';
import { dampMaskGLSL } from './damp-mask.js';

const packs={
  'facility-epoxy':{names:['stagingFloor'],normal:.22,roughness:.86,metalness:0},
  'facility-paint':{names:['containerRed','containerGreen','containerEdge','rack','hvac','caseShell','crane','conduit','ceiling'],normal:.18,roughness:.95,metalness:.12},
  'facility-plaster':{names:['paintedWall'],normal:.3,roughness:1,metalness:0}
};

// World-space variation stays continuous across static batches. Chain the scan
// shader rather than replacing its relief, desaturation or baked contact map.
export function weatherSurface(material,kind){
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.vertexShader='varying vec3 vFacilityWorld;varying vec3 vFacilityNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFacilityWorld=(modelMatrix*vec4(position,1.)).xyz;vFacilityNormal=normal;');
    shader.fragmentShader=`varying vec3 vFacilityWorld;varying vec3 vFacilityNormal;
      ${dampMaskGLSL}
      float facilityHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float facilityNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(facilityHash(i),facilityHash(i+vec2(1.,0.)),f.x),mix(facilityHash(i+vec2(0.,1.)),facilityHash(i+vec2(1.,1.)),f.x),f.y);
      }
      `+shader.fragmentShader;
    const floor=kind==='floor',coating=kind==='coating';
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float facilityMottle=facilityNoise(vFacilityWorld.xz*.58+vFacilityWorld.y*.31);
      ${floor?`
        float facilityPolish=smoothstep(.36,.73,facilityNoise(vFacilityWorld.xz*vec2(.36,.83)));
        float facilityWet=facilityDamp(vFacilityWorld.xz);
        diffuseColor.rgb*=mix(.84,1.06,facilityMottle)*mix(1.,.65,facilityWet);
      `:`
        float facilityFoot=1.-smoothstep(.08,1.25,vFacilityWorld.y);
        diffuseColor.rgb*=mix(.88,1.04,facilityMottle)*mix(1.,.72,facilityFoot);
        ${coating?`
          // Rounded edges expose primer and metal; interrupted vertical trails
          // carry corrosion down from damaged paint rather than tinting all paint.
          vec3 facilityN=abs(normalize(vFacilityNormal));
          float facilityEdge=smoothstep(.14,.31,1.-max(facilityN.x,max(facilityN.y,facilityN.z)));
          vec2 facilityPlane=abs(facilityN.x)>.5?vFacilityWorld.zy:vFacilityWorld.xy;
          float facilityChip=facilityNoise(facilityPlane*48.);
          float facilityDamage=facilityEdge*smoothstep(.5,.76,facilityChip)*.32;
          float facilityRun=pow(facilityNoise(vec2((facilityPlane.x+facilityNoise(facilityPlane*.8)*.045)*23.,facilityPlane.y*.6)),9.);
          float facilityRust=clamp(facilityDamage*.55+facilityRun*.24+facilityFoot*smoothstep(.64,.82,facilityChip)*.12,0.,.8);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.14,.058,.022),facilityRust);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.30,.28),facilityDamage*.65);
        `:''}
      `}`);
    if(floor)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      // Local polished resin catches the environment; the rest remains dry.
      roughnessFactor=clamp(roughnessFactor*mix(1.,.7,facilityPolish)*mix(1.,.18,facilityWet),.12,1.);
    `);
    if(coating){
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor+facilityRust*.22-facilityDamage*.32,.28,1.);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
        metalnessFactor=mix(metalnessFactor,.72,facilityDamage*(1.-facilityRust));
      `);
    }
  };
  material.customProgramCacheKey=()=>`${previousKey}/facility-weather-${kind}-v3`;
  material.needsUpdate=true;
}

export async function loadFacilitySurfaces(view){
  const loader=new T.TextureLoader(),old=new Set(),loaded=[];
  const anisotropy=Math.min(16,view.renderer.capabilities.getMaxAnisotropy());
  await Promise.all(Object.entries(packs).map(async([id,spec])=>{
    const textures=await Promise.all(['albedo','normal','roughness'].map(async(channel,index)=>{
      const texture=await loader.loadAsync(`/art/materials/${id}-${channel}.webp`);
      texture.name=`${id}/${channel}`;texture.userData.source='generated-facility-art';
      texture.colorSpace=index===0?T.SRGBColorSpace:T.NoColorSpace;
      texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=anisotropy;
      return texture;
    }));
    for(const name of spec.names){
      const material=view.materials[name];
      for(const key of ['map','normalMap','roughnessMap'])if(material[key])old.add(material[key]);
      [material.map,material.normalMap,material.roughnessMap]=textures;
      material.normalScale.setScalar(spec.normal);material.roughness=spec.roughness;material.metalness=spec.metalness;
      weatherSurface(material,name==='stagingFloor'?'floor':name==='paintedWall'?'wall':'coating');
    }
    loaded.push(id);
  }));
  // Neutral source colors are tinted here instead of multiplying dark paint by
  // another dark albedo. This preserves texture detail in shaded freight lanes.
  const colors={containerRed:0x925b43,containerGreen:0x667969,containerEdge:0x9b8d70,rack:0x64747a,hvac:0xb8bcb1,caseShell:0x849074,crane:0xc9a34c,conduit:0x969f9b,ceiling:0x748381,paintedWall:0x829187,stagingFloor:0x9baba8};
  for(const [name,color] of Object.entries(colors))view.materials[name].color.setHex(color);
  weatherSurface(view.materials.floor,'floor');
  weatherSurface(view.materials.wall,'wall');weatherSurface(view.materials.concrete,'wall');
  const live=new Set(Object.values(view.materials).flatMap(m=>[m.map,m.normalMap,m.roughnessMap]));
  for(const texture of old)if(!live.has(texture))texture.dispose();
  return loaded.sort();
}
