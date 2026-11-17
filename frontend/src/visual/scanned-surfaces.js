import * as T from 'three/webgpu';
import { materialColor, positionWorld, vec3, dot, mix, smoothstep } from 'three/tsl';
import { maxAnisotropy } from './renderer.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MAP } from '../game/data.js';
import { bakeFacilityOcclusion } from './facility-occlusion.js';

export async function loadScannedSurfaces(view){
  const loader=new T.TextureLoader(),anisotropy=maxAnisotropy(view.renderer);
  const specs=[['concrete_floor_02',['floor'],[MAP.width/4,MAP.depth/4]],['concrete_wall_008',['wall','concrete'],[1,1]]];
  const replaced=new Set();
  await Promise.all(specs.map(async([id,names,repeat])=>{
    const textures=await Promise.all(['diff','nor_gl','rough'].map(async(channel,i)=>{
      const t=await loader.loadAsync(`/art/scanned/${id}-${channel}.webp`);
      t.name=`${id}/${channel}`;t.userData.source='scanned-cc0';t.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;
      t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=anisotropy;return t;
    }));
    for(const name of names){
      const m=view.materials[name];for(const channel of ['map','normalMap','roughnessMap'])if(m[channel])replaced.add(m[channel]);
      [m.map,m.normalMap,m.roughnessMap]=textures;m.color.setHex(name==='floor'?0xb9c0bc:0xe1e4df);
      // Preserve the scan's relief while keeping concrete neutral under mixed light.
      const base=materialColor.rgb,luma=dot(base,vec3(.2126,.7152,.0722));
      const neutral=mix(vec3(luma),base,.35);
      m.colorNode=name==='floor'?mix(neutral,vec3(.23,.24,.23),.25):neutral.mul(mix(.76,1,smoothstep(.04,.8,positionWorld.y)));
      m.normalScale.setScalar(name==='floor'?.4:.65);m.roughness=1;m.metalness=0;m.needsUpdate=true;
    }
  }));
  const live=new Set(Object.values(view.materials).flatMap(m=>[m.map,m.normalMap,m.roughnessMap]));for(const t of replaced)if(!live.has(t))t.dispose();
  view.staticContact=bakeFacilityOcclusion(view.materials.floor);
  const source=await new HDRLoader().loadAsync('/art/scanned/warehouse-1k.hdr');
  source.mapping=T.EquirectangularReflectionMapping;
  const pmrem=new T.PMREMGenerator(view.renderer),target=await pmrem.fromEquirectangularAsync(source),previous=view.environment;
  target.texture.name='warehouse-prefiltered';target.texture.userData.source='cc0-hdr';
  view.environment=target.texture;view.environmentTarget=target;view.scene.environment=view.gunScene.environment=target.texture;
  view.scene.environmentRotation.y=.55;view.gunScene.environmentRotation.y=.55;
  source.dispose();pmrem.dispose();previous?.dispose();
  return ['concrete_floor_02','concrete_wall_008','empty_warehouse_01'];
}
