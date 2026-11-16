import * as T from 'three';

// One baked probe per wing, shared by that wing's coated equipment. The HDR
// remains the scene fallback; local probes capture the actual ceiling and lamps.
export function captureFacilityProbes(view){
  const {renderer,scene}=view,pmrem=new T.PMREMGenerator(renderer);
  const previousTarget=renderer.getRenderTarget(),toneMapping=renderer.toneMapping;
  const wetVisible=view.wetFloor.visible,hidden=[view.coreGroup,view.ring,view.dust];
  const visibility=hidden.map(o=>o.visible),probes=[];
  const fill=scene.children.find(o=>o.isHemisphereLight),fillIntensity=fill.intensity;
  const shadowStates=view.localLights.map(light=>light.castShadow);
  try{
    renderer.toneMapping=T.NoToneMapping;view.wetFloor.visible=false;
    // Approximate the diffuse bounce missing from this direct-light renderer.
    fill.intensity=1.25;
    hidden.forEach(o=>o.visible=false);
    view.localLights.forEach(light=>light.castShadow=false);
    for(const [name,z] of [['freight',-14],['service',14]]){
      const cube=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType,generateMipmaps:false});
      try{
        const camera=new T.CubeCamera(.1,85,cube);camera.position.set(0,2.1,z);camera.update(renderer,scene);
        const target=pmrem.fromCubemap(cube.texture);target.texture.name=`facility-${name}-probe`;target.texture.userData.source='local-facility-capture';
        probes.push({name,target});
      }finally{cube.dispose();}
    }
    // Assign only after both captures, so neither capture contains the other probe.
    const assignments=[['containerRed','containerGreen','containerEdge','crane'],['rack','hvac','caseShell','worktop']];
    probes.forEach((probe,i)=>{for(const name of assignments[i]){
      const material=view.materials[name];material.envMap=probe.target.texture;material.envMapRotation.set(0,0,0);material.envMapIntensity=.85;
      // Keep a modest diffuse bounce floor: the capture contains direct lighting,
      // whereas the warehouse HDR it replaces also contains real bounced light.
      const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
      material.onBeforeCompile=function(shader,renderer){
        previous.call(this,shader,renderer);
        shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',T.ShaderChunk.envmap_physical_pars_fragment.replace('return PI * envMapColor.rgb * envMapIntensity;','return PI * (envMapColor.rgb * envMapIntensity + vec3(.26,.28,.27));'));
      };
      material.customProgramCacheKey=()=>`${key}/probe-bounce-v1`;material.needsUpdate=true;
    }});
    return probes;
  }finally{
    renderer.toneMapping=toneMapping;renderer.setRenderTarget(previousTarget);fill.intensity=fillIntensity;
    view.wetFloor.visible=wetVisible;hidden.forEach((o,i)=>o.visible=visibility[i]);
    view.localLights.forEach((light,i)=>light.castShadow=shadowStates[i]);pmrem.dispose();
  }
}
