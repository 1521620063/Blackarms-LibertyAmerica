// Stable object-space detail survives weapon movement and character skinning.
// Derivative filtering prevents the fine grain from shimmering at a distance.
export function microSurface(material,{wear=.14,grain=.035}={}){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous.call(material,shader);
    shader.vertexShader='varying vec3 vFinishPosition; varying vec3 vFinishNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition=position;vFinishNormal=normal;');
    shader.fragmentShader=`varying vec3 vFinishPosition; varying vec3 vFinishNormal;
      float finishHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float finishNoise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(finishHash(i),finishHash(i+vec3(1,0,0)),f.x),mix(finishHash(i+vec3(0,1,0)),finishHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(finishHash(i+vec3(0,0,1)),finishHash(i+vec3(1,0,1)),f.x),mix(finishHash(i+vec3(0,1,1)),finishHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      \n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 finishN=abs(normalize(vFinishNormal));
      float finishBevel=smoothstep(.035,.33,1.-max(finishN.x,max(finishN.y,finishN.z)))*.35;
      float finishNoise=finishNoise3(vFinishPosition*135.);
      float finishFilter=1.-smoothstep(.25,1.8,length(fwidth(vFinishPosition*900.)));
      float finishGrain=(finishHash(floor(vFinishPosition*900.))-.5)*finishFilter;
      float finishWear=finishBevel*smoothstep(.28,.78,finishNoise)*${wear.toFixed(4)};
      diffuseColor.rgb*=1.+finishGrain*${grain.toFixed(4)};
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.35,.33),finishWear);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+finishGrain*.035-finishWear*.25,.18,1.);');
  };
  material.customProgramCacheKey=()=>`micro-surface-3:${wear}:${grain}`;
  return material;
}
