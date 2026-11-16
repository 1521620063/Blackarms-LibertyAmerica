import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MAP } from '../shared/data.js';

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
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      void main(){
        vec2 p=vWetWorld.xz;
        float lanes=max(1.-smoothstep(1.6,3.3,abs(abs(p.y)-14.)),(1.-smoothstep(.6,1.7,abs(abs(p.y)-5.)))*.7);
        float shape=noise(p*.92)*.68+noise(p*2.7)*.32;
        float mask=smoothstep(.52,.7,shape)*lanes;
        if(mask<.015)discard;
        vec3 sight=normalize(cameraPosition-vWetWorld);
        float fresnel=.08+.55*pow(1.-max(sight.y,0.),4.);
        vec2 uv=vProjected.xy/vProjected.w;
        uv+=vec2(sin(p.y*17.+time*.7),cos(p.x*19.-time*.55))*.00022;
        vec3 reflection=texture2D(tDiffuse,uv).rgb*.4;
        reflection+=(texture2D(tDiffuse,uv+texel*vec2(1.5,0.)).rgb+texture2D(tDiffuse,uv-texel*vec2(1.5,0.)).rgb+texture2D(tDiffuse,uv+texel*vec2(0.,1.5)).rgb+texture2D(tDiffuse,uv-texel*vec2(0.,1.5)).rgb)*.15;
        gl_FragColor=vec4(mix(color*.22,reflection,.9),mask*fresnel*.8);
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
