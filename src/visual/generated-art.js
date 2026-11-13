import * as T from 'three';

const specs={
  concrete:{materials:['concrete','wall'],repeat:[1,1],normal:.48},
  floor:{materials:['floor'],repeat:[16,10],normal:.3},
  gunmetal:{materials:['steel','dark','edge','armor','yellow','polymer','gunmetal','titanium'],repeat:[1,1],normal:.24},
  fabric:{materials:['olive','sand'],repeat:[1,1],normal:.45},
  'service-panel':{materials:['panel'],repeat:[1,1],normal:.15}
};

export async function loadGeneratedArt(materials,renderer){
  const loader=new T.TextureLoader(),oldTextures=new Set(),loaded=[];
  const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  await Promise.all(Object.entries(specs).map(async([id,spec])=>{
    const maps=await Promise.all(['albedo','normal','roughness'].map(async channel=>{
      const ext='webp',url=`/art/materials/${id}-${channel}.${ext}`;
      const texture=await loader.loadAsync(url);texture.name=`${id}/${channel}`;texture.userData.source='generated-art';
      texture.colorSpace=channel==='albedo'?T.SRGBColorSpace:T.NoColorSpace;texture.anisotropy=anisotropy;
      if(id!=='service-panel'){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(...spec.repeat);}
      return texture;
    }));
    for(const name of spec.materials){
      const material=materials[name];for(const key of ['map','normalMap','roughnessMap'])if(material[key])oldTextures.add(material[key]);
      [material.map,material.normalMap,material.roughnessMap]=maps;
      material.normalScale.setScalar(spec.normal);material.needsUpdate=true;
    }
    loaded.push(id);
  }));
  const liveTextures=new Set(Object.values(materials).flatMap(m=>[m.map,m.normalMap,m.roughnessMap]).filter(Boolean));
  for(const texture of oldTextures)if(!liveTextures.has(texture))texture.dispose();
  // Tint albedo only slightly: the authored source already contains real surface color.
  const colors={concrete:0xbac0b9,wall:0xe0e1d8,floor:0xc6cecf,steel:0x627073,dark:0x303b3f,edge:0x8f9999,armor:0x68736a,yellow:0xe4b658,polymer:0x8b8e73,olive:0x8e9e7d,sand:0xb6ae90,panel:0xc8d3d4};
  for(const [name,color] of Object.entries(colors))materials[name].color.setHex(color);
  materials.floor.metalness=.03;materials.floor.roughness=.97;materials.wall.roughness=1;materials.concrete.roughness=1;
  materials.steel.metalness=.65;materials.dark.metalness=.45;materials.panel.metalness=.45;
  return loaded.sort();
}
