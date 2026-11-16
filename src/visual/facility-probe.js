import * as T from 'three/webgpu';

// Capture each wing directly into WebGPU's PMREM render targets.
export async function captureFacilityProbes(view){
  const {renderer,scene}=view,pmrem=new T.PMREMGenerator(renderer);
  const hidden=[view.wetFloor,view.coreGroup,view.ring,view.dust],visibility=hidden.map(o=>o.visible),probes=[];
  const fill=scene.children.find(o=>o.isHemisphereLight),intensity=fill.intensity;
  const shadowStates=view.localLights.map(light=>light.castShadow);
  try{
    fill.intensity=1.25;hidden.forEach(o=>o.visible=false);view.localLights.forEach(light=>light.castShadow=false);
    for(const [name,z] of [['freight',-14],['service',14]]){
      const target=await pmrem.fromSceneAsync(scene,0,.1,85,{size:128,position:new T.Vector3(0,2.1,z)});
      target.texture.name=`facility-${name}-probe`;target.texture.userData.source='local-facility-capture';probes.push({name,target});
    }
    const assignments=[['containerRed','containerGreen','containerEdge','crane'],['rack','hvac','caseShell','worktop']];
    probes.forEach((probe,i)=>{for(const name of assignments[i]){
      const material=view.materials[name];material.envMap=probe.target.texture;material.envMapRotation.set(0,0,0);material.envMapIntensity=.85;material.needsUpdate=true;
    }});
    return probes;
  }catch(error){for(const probe of probes)probe.target.dispose();throw error;}
  finally{
    fill.intensity=intensity;hidden.forEach((o,i)=>o.visible=visibility[i]);
    view.localLights.forEach((light,i)=>light.castShadow=shadowStates[i]);pmrem.dispose();
  }
}
