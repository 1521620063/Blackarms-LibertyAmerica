import * as T from 'three/webgpu';
import { positionWorld, normalGeometry, materialColor, materialRoughness, materialMetalness, float, vec3, mix, max, abs, smoothstep } from 'three/tsl';
import { maxAnisotropy } from './renderer.js';
import { facilityDamp, dampNoise } from './damp-mask.js';

const packs={
  'facility-epoxy':{names:['stagingFloor'],normal:.22,roughness:.86,metalness:0},
  'facility-paint':{names:['containerRed','containerGreen','containerEdge','rack','hvac','caseShell','crane','conduit','ceiling'],normal:.18,roughness:.95,metalness:.12},
  'facility-plaster':{names:['paintedWall'],normal:.3,roughness:1,metalness:0}
};

// Shared world coordinates preserve weathering across merged static geometry.
export function weatherSurface(material,kind){
  const p=positionWorld,n=abs(normalGeometry.normalize());
  const mottle=dampNoise(p.xz.mul(.58).add(p.y.mul(.31)));
  const base=material.colorNode||materialColor.rgb;
  const roughness=material.roughnessNode||materialRoughness;
  if(kind==='floor'){
    const polish=smoothstep(.36,.73,dampNoise(p.xz.mul(vec3(.36,0,.83).xz))),wet=facilityDamp(p.xz);
    material.colorNode=base.mul(mix(.84,1.06,mottle)).mul(mix(1,.65,wet));
    material.roughnessNode=roughness.mul(mix(1,.7,polish)).mul(mix(1,.18,wet)).clamp(.12,1);
  }else{
    const foot=float(1).sub(smoothstep(.08,1.25,p.y));
    let tint=base.mul(mix(.88,1.04,mottle)).mul(mix(1,.72,foot));
    if(kind==='coating'){
      const edge=smoothstep(.14,.31,float(1).sub(max(n.x,max(n.y,n.z))));
      const plane=n.x.greaterThan(.5).select(p.zy,p.xy),chip=dampNoise(plane.mul(48));
      const damage=edge.mul(smoothstep(.5,.76,chip)).mul(.32);
      const run=dampNoise(plane.mul(vec3(23,.6,0).xy)).pow(9);
      const rust=damage.mul(.55).add(run.mul(.24)).add(foot.mul(smoothstep(.64,.82,chip)).mul(.12)).clamp(0,.8);
      tint=mix(mix(tint,vec3(.14,.058,.022),rust),vec3(.29,.30,.28),damage.mul(.65));
      material.roughnessNode=roughness.add(rust.mul(.22)).sub(damage.mul(.32)).clamp(.28,1);
      material.metalnessNode=mix(materialMetalness,.72,damage.mul(float(1).sub(rust)));
    }
    material.colorNode=tint;
  }
  material.needsUpdate=true;
}

export async function loadFacilitySurfaces(view,manager){
  const loader=new T.TextureLoader(manager),old=new Set(),loaded=[];
  const anisotropy=maxAnisotropy(view.renderer);
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
