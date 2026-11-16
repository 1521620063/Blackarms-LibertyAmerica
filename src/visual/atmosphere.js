import * as T from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Depth-bounded single scattering. Every sample checks the directional shadow
// map, so light shafts follow actual roof apertures and stop at solid geometry.
export function atmospherePass(view){
  const white=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;
  const pass=new ShaderPass({
    defines:{ATMOSPHERE_STEPS:16},
    uniforms:{tDiffuse:{value:null},tDepth:{value:view.occlusion.depthTexture},tShadow:{value:white},inverseProjection:{value:view.camera.projectionMatrixInverse},cameraWorld:{value:view.camera.matrixWorld},shadowMatrix:{value:view.sun.shadow.matrix},lightDirection:{value:view.sun.position.clone().normalize()},lightColor:{value:new T.Color(0xffe0b0)},density:{value:.009},strength:{value:.24}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`
      #include <packing>
      varying vec2 vUv;
      uniform sampler2D tDiffuse,tDepth,tShadow;
      uniform mat4 inverseProjection,cameraWorld,shadowMatrix;
      uniform vec3 lightDirection,lightColor;
      uniform float density,strength;
      float random(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      float visibility(vec3 p){
        vec4 shadow=shadowMatrix*vec4(p,1.);vec3 q=shadow.xyz/shadow.w;
        if(any(lessThan(q,vec3(0.)))||any(greaterThan(q,vec3(1.))))return 0.;
        float depth=unpackRGBAToDepth(texture2D(tShadow,q.xy));return step(q.z-.0003,depth);
      }
      void main(){
        vec4 color=texture2D(tDiffuse,vUv);
        float depth=texture2D(tDepth,vUv).x;
        vec4 projected=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);
        vec3 end=(cameraWorld*vec4(projected.xyz/projected.w,1.)).xyz;
        vec3 origin=cameraWorld[3].xyz,direction=normalize(end-origin);
        float distanceToSurface=min(length(end-origin),42.),stepLength=distanceToSurface/float(ATMOSPHERE_STEPS);
        float start=random(gl_FragCoord.xy),scattering=0.;
        for(int i=0;i<ATMOSPHERE_STEPS;i++){
          float travel=(float(i)+start)*stepLength;
          vec3 p=origin+direction*travel;
          float dust=mix(1.,.45,smoothstep(0.,5.6,p.y));
          scattering+=visibility(p)*dust*exp(-travel*density)*stepLength*density;
        }
        float phase=.7+.6*pow(max(0.,dot(direction,lightDirection)),5.);
        vec3 mist=vec3(.24,.3,.33)*(1.-exp(-distanceToSurface*.0015));
        color.rgb+=mist+lightColor*scattering*strength*phase;
        gl_FragColor=color;
      }`
  });
  pass.fallbackShadow=white;
  return pass;
}
