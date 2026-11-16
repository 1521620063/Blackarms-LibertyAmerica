import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MAP } from '../shared/data.js';
import { dampMaskGLSL } from './damp-mask.js';

// One shared reflection target for damp patches, rather than one render per
// puddle. The reflected scene includes actual lamps, cover and moving actors.
export function createWetFloor(view){
  const shader={
    name:'FacilityDampFloor',
    uniforms:{tDiffuse:{value:null},textureMatrix:{value:null},color:{value:new T.Color(0x535f60)},time:{value:0},texel:{value:new T.Vector2(1/512,1/512)}},
    vertexShader:`uniform mat4 textureMatrix;
      varying vec4 vProjected;varying vec3 vWetWorld;
      void main(){vProjected=textureMatrix*vec4(position,1.);vWetWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 color;uniform float time;uniform vec2 texel;
      varying vec4 vProjected;varying vec3 vWetWorld;
      ${dampMaskGLSL}
      void main(){
        vec2 p=vWetWorld.xz;
        float mask=facilityDamp(p);
        if(mask<.015)discard;
        vec3 sight=normalize(cameraPosition-vWetWorld);
        float fresnel=.14+.7*pow(1.-max(sight.y,0.),3.);
        vec2 uv=vProjected.xy/vProjected.w;
        vec2 ripple=vec2(dampNoise(p*3.1+vec2(time*.035,0.)),dampNoise(p*3.1-vec2(0.,time*.03)))-.5;
        uv+=ripple*.0011+vec2(sin(p.y*17.+time*.7),cos(p.x*19.-time*.55))*.00012;
        // Damp margins scatter more than the centre of the same puddle.
        vec2 blur=texel*mix(2.6,.45,mask);
        vec3 reflection=texture2D(tDiffuse,uv).rgb*.4;
        reflection+=(texture2D(tDiffuse,uv+vec2(blur.x,0.)).rgb+texture2D(tDiffuse,uv-vec2(blur.x,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,blur.y)).rgb+texture2D(tDiffuse,uv-vec2(0.,blur.y)).rgb)*.15;
        float border=smoothstep(0.,.025,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
        gl_FragColor=vec4(mix(color*.16,reflection,.96),mask*fresnel*.95*border);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  };
  const floor=new Reflector(new T.PlaneGeometry(MAP.width-.1,MAP.depth-.1),{shader,textureWidth:512,textureHeight:512,multisample:0,clipBias:.002});
  floor.name='facility-damp-reflections';floor.rotation.x=-Math.PI/2;floor.position.y=.026;
  floor.material.transparent=true;floor.material.depthWrite=false;floor.renderOrder=2;
  const reflect=floor.onBeforeRender;
  floor.onBeforeRender=function(renderer,scene,camera){
    // GTAO renders an override normal/depth pass; it must never trigger another
    // scene reflection or reflect the normal material instead of the world.
    if(!scene.overrideMaterial)reflect.call(this,renderer,scene,camera);
  };
  view.scene.add(floor);
  return floor;
}
