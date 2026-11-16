import * as T from 'three';

// Patch only directional shadow calls on large facility surfaces. Spot lights
// and first-person equipment retain Three's PCF with their own camera ranges.
export function facilitySunShadows(view){
  const camera=view.sun.shadow.camera;
  const uniforms={
    facilityShadowSpan:{value:new T.Vector2(camera.right-camera.left,camera.top-camera.bottom)},
    facilityShadowDepth:{value:camera.far-camera.near},
    facilityShadowTaps:{value:16}
  };
  const glsl=`
    #ifdef USE_SHADOWMAP
    uniform vec2 facilityShadowSpan;
    uniform float facilityShadowDepth;
    uniform int facilityShadowTaps;
    vec2 facilityDisk(int i,float count,float phase){
      float r=sqrt((float(i)+.5)/count),a=float(i)*2.39996323+phase;
      return r*vec2(cos(a),sin(a));
    }
    float facilitySunShadow(sampler2D shadowMap,vec2 mapSize,float intensity,float bias,float radius,vec4 coord){
      vec3 sc=coord.xyz/coord.w;
      vec3 dx=dFdx(sc),dy=dFdy(sc);
      if(sc.x<0.||sc.x>1.||sc.y<0.||sc.y>1.||sc.z>1.||sc.z<0.)return 1.;
      float determinant=dx.x*dy.y-dx.y*dy.x;
      vec2 slope=vec2(0.),texel=1./mapSize;
      if(abs(determinant)>1e-12)slope=vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/determinant;
      slope=clamp(slope,vec2(-6.),vec2(6.));
      float receiver=sc.z+bias-dot(abs(slope),texel)*.35;
      // A fixed world-space phase avoids changing the pattern as the camera moves.
      float phase=fract(sin(dot(floor(sc.xy*mapSize),vec2(12.9898,78.233)))*43758.5453)*6.2831853;
      float blockers=0.,depthSum=0.;
      for(int i=0;i<8;i++){
        vec2 offset=facilityDisk(i,8.,phase)*.28/facilityShadowSpan;
        float depth=unpackRGBAToDepth(texture2D(shadowMap,clamp(sc.xy+offset,texel,1.-texel)));
        if(depth<receiver+dot(offset,slope)){depthSum+=depth;blockers+=1.;}
      }
      if(blockers<.5)return 1.;
      float separation=max(receiver-depthSum/blockers,0.)*facilityShadowDepth;
      vec2 filterRadius=max(vec2(clamp(separation*.022,.012,.24))/facilityShadowSpan,texel*1.1);
      float lit=0.;
      for(int i=0;i<16;i++){
        if(i>=facilityShadowTaps)break;
        vec2 offset=facilityDisk(i,float(facilityShadowTaps),phase+1.7)*filterRadius;
        lit+=texture2DCompare(shadowMap,clamp(sc.xy+offset,texel,1.-texel),receiver+dot(offset,slope));
      }
      return mix(1.,lit/float(facilityShadowTaps),intensity);
    }
    #endif
  `;
  for(const name of ['floor','wall','concrete','paintedWall','stagingFloor','containerRed','containerGreen','containerEdge','rack','hvac','caseShell','crane','conduit','ceiling']){
    const material=view.materials[name],previous=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader,renderer){
      previous.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',T.ShaderChunk.shadowmap_pars_fragment+'\n'+glsl);
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',T.ShaderChunk.lights_fragment_begin.replace('getShadow( directionalShadowMap[ i ]','facilitySunShadow( directionalShadowMap[ i ]'));
    };
    material.customProgramCacheKey=()=>`${key}/facility-sun-v1`;material.needsUpdate=true;
  }
  return uniforms;
}
