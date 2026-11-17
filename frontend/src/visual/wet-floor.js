import * as T from 'three/webgpu';
import { reflector, positionWorld, cameraPosition, uniform, float, vec2, vec3, mix, sin, cos } from 'three/tsl';
import { MAP } from '../game/data.js';
import { facilityDamp, dampNoise } from './damp-mask.js';

export function createWetFloor(view){
  const reflection=reflector({resolutionScale:1/3,generateMipmaps:false,bounces:false,samples:0});
  const time=uniform(0),p=positionWorld.xz,mask=facilityDamp(p);
  const ripple=vec2(dampNoise(p.mul(3.1).add(vec2(time.mul(.035),0))),dampNoise(p.mul(3.1).sub(vec2(0,time.mul(.03))))).sub(.5).mul(.0011);
  const distortion=vec2(sin(p.y.mul(17).add(time.mul(.7))),cos(p.x.mul(19).sub(time.mul(.55)))).mul(.00012);
  reflection.uvNode=reflection.uvNode.add(ripple).add(distortion);
  const sight=cameraPosition.sub(positionWorld).normalize(),fresnel=float(1).sub(sight.y.max(0)).pow(3).mul(.7).add(.14);
  const material=new T.MeshBasicNodeMaterial({transparent:true,depthWrite:false});
  material.colorNode=mix(vec3(.052,.06,.06),reflection.rgb,.96);
  material.opacityNode=mask.mul(fresnel).mul(.95);
  const floor=new T.Mesh(new T.PlaneGeometry(MAP.width-.1,MAP.depth-.1),material);
  floor.name='facility-damp-reflections';floor.rotation.x=-Math.PI/2;floor.position.y=.026;floor.renderOrder=2;
  floor.add(reflection.target);floor.userData.reflection=reflection;
  // Share the same world-space shoreline with the PBR ground.
  material.uniforms={time};
  floor.getRenderTarget=()=>reflection.reflector.getRenderTarget(view.camera);
  view.scene.add(floor);return floor;
}
