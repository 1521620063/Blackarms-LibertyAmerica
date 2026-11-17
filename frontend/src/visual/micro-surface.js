import { positionGeometry, normalGeometry, materialColor, materialRoughness, vec3, float, fract, floor, dot, smoothstep, mix, max, abs, fwidth, length } from 'three/tsl';
import { dampNoise } from './damp-mask.js';

// Object coordinates keep the finish attached to skinned and moving equipment.
export function microSurface(material,{wear=.14,grain=.035}={}){
  const n=abs(normalGeometry.normalize());
  const bevel=smoothstep(.035,.33,float(1).sub(max(n.x,max(n.y,n.z)))).mul(.35);
  const p=positionGeometry.mul(900),hash=fract(dot(floor(p),vec3(127.1,311.7,74.7)).sin().mul(43758.5453));
  const filter=float(1).sub(smoothstep(.25,1.8,length(fwidth(p))));
  const noise=hash.sub(.5).mul(filter),worn=bevel.mul(smoothstep(.28,.78,dampNoise(positionGeometry.xy.mul(135)))).mul(wear);
  material.colorNode=mix(materialColor.rgb.mul(noise.mul(grain).add(1)),vec3(.34,.35,.33),worn);
  material.roughnessNode=materialRoughness.add(noise.mul(.035)).sub(worn.mul(.25)).clamp(.18,1);
  return material;
}
