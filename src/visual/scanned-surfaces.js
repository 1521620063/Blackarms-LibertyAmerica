import * as T from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MAP } from '../shared/data.js';
import { bakeFacilityOcclusion } from './facility-occlusion.js';

export async function loadScannedSurfaces(view){
  const loader=new T.TextureLoader(),anisotropy=Math.min(16,view.renderer.capabilities.getMaxAnisotropy());
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
      m.onBeforeCompile=shader=>{
        shader.vertexShader='varying float vConcreteHeight;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvConcreteHeight=(modelMatrix*vec4(position,1.)).y;');
        shader.fragmentShader='varying float vConcreteHeight;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float scannedLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=mix(vec3(scannedLuma),diffuseColor.rgb,.35);
        ${name==='floor'?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.24,.23),.25);':'diffuseColor.rgb*=mix(.76,1.,smoothstep(.04,.8,vConcreteHeight));'}
      `);};m.customProgramCacheKey=()=>`scanned-concrete-${name}`;
      m.normalScale.setScalar(name==='floor'?.4:.65);m.roughness=1;m.metalness=0;m.needsUpdate=true;
    }
  }));
  const live=new Set(Object.values(view.materials).flatMap(m=>[m.map,m.normalMap,m.roughnessMap]));for(const t of replaced)if(!live.has(t))t.dispose();
  view.staticContact=bakeFacilityOcclusion(view.materials.floor);
  const source=await new HDRLoader().loadAsync('/art/scanned/warehouse-1k.hdr');
  source.mapping=T.EquirectangularReflectionMapping;
  const pmrem=new T.PMREMGenerator(view.renderer),target=pmrem.fromEquirectangular(source),previous=view.environment;
  target.texture.name='warehouse-prefiltered';target.texture.userData.source='cc0-hdr';
  view.environment=target.texture;view.environmentTarget=target;view.scene.environment=view.gunScene.environment=target.texture;
  view.scene.environmentRotation.y=.55;view.gunScene.environmentRotation.y=.55;
  source.dispose();pmrem.dispose();previous.dispose();
  return ['concrete_floor_02','concrete_wall_008','empty_warehouse_01'];
}
