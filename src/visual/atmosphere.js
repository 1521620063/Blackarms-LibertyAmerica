import * as T from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Depth-bounded scattering from skylights and the two nearby shadowed lamps.
// Reuse the lighting shadow maps: solid walls and cover also occlude the mist.
export function atmospherePass(view){
  const white=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;
  const pass=new ShaderPass({
    name:'FacilityLightShafts',
    defines:{ATMOSPHERE_STEPS:24},
    uniforms:{
      tDiffuse:{value:null},tDepth:{value:view.occlusion.depthTexture},tShadow:{value:white},
      inverseProjection:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()},shadowMatrix:{value:new T.Matrix4()},
      lightDirection:{value:view.sun.position.clone().normalize()},lightColor:{value:new T.Color(0xffe0b0)},
      density:{value:.027},strength:{value:.85},lampStrength:{value:1.65},time:{value:0},
      lampPosition:{value:[new T.Vector4(),new T.Vector4()]},lampDirection:{value:[new T.Vector4(),new T.Vector4()]},
      lampColor:{value:[new T.Vector3(),new T.Vector3()]},lampShadowMatrix:{value:[new T.Matrix4(),new T.Matrix4()]},
      tLampShadow0:{value:white},tLampShadow1:{value:white}
    },
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`
      #include <packing>
      varying vec2 vUv;
      uniform sampler2D tDiffuse,tDepth,tShadow,tLampShadow0,tLampShadow1;
      uniform mat4 inverseProjection,cameraWorld,shadowMatrix,lampShadowMatrix[2];
      uniform vec3 lightDirection,lightColor,lampColor[2];
      uniform vec4 lampPosition[2],lampDirection[2];
      uniform float density,strength,lampStrength,time;
      float random(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      float visibility(sampler2D shadowMap,mat4 matrix,vec3 p){
        vec4 shadow=matrix*vec4(p,1.);vec3 q=shadow.xyz/shadow.w;
        if(any(lessThan(q,vec3(0.)))||any(greaterThan(q,vec3(1.))))return 0.;
        float depth=unpackRGBAToDepth(texture2D(shadowMap,q.xy));return step(q.z-.0002,depth);
      }
      vec3 lampScattering(vec3 p,vec3 ray,vec4 position,vec4 direction,vec3 tint,mat4 matrix,sampler2D shadowMap){
        if(position.w<=0.)return vec3(0.);
        vec3 offset=p-position.xyz;float travel=length(offset);
        vec3 fromLamp=offset/max(travel,.001);
        float cone=smoothstep(direction.w,mix(direction.w,1.,.45),dot(fromLamp,direction.xyz));
        if(cone<=.001||travel>position.w)return vec3(0.);
        float falloff=1./(1.+travel*travel*.12);
        float endFade=1.-smoothstep(position.w*.7,position.w,travel);
        float phase=.65+.65*pow(max(0.,dot(ray,-fromLamp)),4.);
        return tint*cone*falloff*endFade*phase*visibility(shadowMap,matrix,p);
      }
      void main(){
        vec4 color=texture2D(tDiffuse,vUv);
        float depth=texture2D(tDepth,vUv).x;
        vec4 projected=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);
        vec3 end=(cameraWorld*vec4(projected.xyz/projected.w,1.)).xyz;
        vec3 origin=cameraWorld[3].xyz,direction=normalize(end-origin);
        float distanceToSurface=min(length(end-origin),42.),stepLength=distanceToSurface/float(ATMOSPHERE_STEPS);
        float start=random(gl_FragCoord.xy);vec3 scattering=vec3(0.);
        float sunPhase=.7+.8*pow(max(0.,dot(direction,lightDirection)),5.);
        for(int i=0;i<ATMOSPHERE_STEPS;i++){
          float travel=(float(i)+start)*stepLength;
          vec3 p=origin+direction*travel;
          float dust=mix(1.,.72,smoothstep(0.,5.6,p.y));
          dust*=.9+.1*sin(p.x*1.7+p.z*.9+sin(p.y*2.3)+time*.12);
          vec3 sunlight=lightColor*visibility(tShadow,shadowMatrix,p)*strength*sunPhase;
          vec3 lamps=lampScattering(p,direction,lampPosition[0],lampDirection[0],lampColor[0],lampShadowMatrix[0],tLampShadow0);
          lamps+=lampScattering(p,direction,lampPosition[1],lampDirection[1],lampColor[1],lampShadowMatrix[1],tLampShadow1);
          scattering+=(sunlight+lamps*lampStrength)*dust*exp(-travel*density)*stepLength*density;
        }
        // Slight extinction gives the beams contrast without obscuring targets.
        color.rgb*=exp(-distanceToSurface*density*.055);
        color.rgb+=vec3(.24,.3,.33)*(1.-exp(-distanceToSurface*.002))+scattering;
        gl_FragColor=color;
      }`
  });
  const position=new T.Vector3(),target=new T.Vector3(),direction=new T.Vector3();
  const render=pass.render;
  pass.render=function(renderer,writeBuffer,readBuffer,deltaTime,maskActive){
    // ShaderPass clones uniforms. Refresh matrices after the world/depth passes,
    // when both the camera and all selected light shadow maps are current.
    const u=this.uniforms;
    u.inverseProjection.value.copy(view.camera.projectionMatrixInverse);
    u.cameraWorld.value.copy(view.camera.matrixWorld);
    u.shadowMatrix.value.copy(view.sun.shadow.matrix);
    u.tShadow.value=view.sun.shadow.map?.texture||white;
    u.tDepth.value=view.occlusion.depthTexture;
    u.time.value=view.wetFloor?.material.uniforms.time.value||0;
    const lamps=view.localLights.filter(light=>light.castShadow&&light.shadow.map).slice(0,2);
    for(let i=0;i<2;i++){
      const light=lamps[i];
      u.lampPosition.value[i].set(0,0,0,0);
      u.lampColor.value[i].set(0,0,0);
      u[`tLampShadow${i}`].value=white;
      if(!light)continue;
      light.getWorldPosition(position);light.target.getWorldPosition(target);direction.subVectors(target,position).normalize();
      u.lampPosition.value[i].set(position.x,position.y,position.z,Math.min(light.distance,7));
      u.lampDirection.value[i].set(direction.x,direction.y,direction.z,Math.cos(light.angle));
      u.lampColor.value[i].set(light.color.r,light.color.g,light.color.b).multiplyScalar(light.intensity/130);
      u.lampShadowMatrix.value[i].copy(light.shadow.matrix);
      u[`tLampShadow${i}`].value=light.shadow.map.texture;
    }
    render.call(this,renderer,writeBuffer,readBuffer,deltaTime,maskActive);
  };
  pass.fallbackShadow=white;
  return pass;
}
