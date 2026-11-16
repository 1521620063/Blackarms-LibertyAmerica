import { Fn, vec2, float, floor, fract, sin, dot, mix, smoothstep, length, max, abs } from 'three/tsl';

export const dampHash=Fn(([p])=>fract(sin(dot(p,vec2(127.1,311.7))).mul(43758.5453)));
export const dampNoise=Fn(([p])=>{
  const i=floor(p),f=fract(p),s=f.mul(f).mul(float(3).sub(f.mul(2)));
  return mix(mix(dampHash(i),dampHash(i.add(vec2(1,0))),s.x),mix(dampHash(i.add(vec2(0,1))),dampHash(i.add(1)),s.x),s.y);
});
const pool=(p,centre,radius)=>float(1).sub(smoothstep(.45,1,length(p.sub(centre).div(radius))));
export const facilityDamp=Fn(([p])=>{
  const freight=float(1).sub(smoothstep(2.1,4.4,abs(abs(p.y).sub(14))));
  const annex=float(1).sub(smoothstep(1.9,4.3,abs(abs(p.y).sub(23))));
  const galleries=float(1).sub(smoothstep(1.3,3.6,abs(abs(p.x).sub(35))));
  const inner=float(1).sub(smoothstep(.9,2.6,abs(abs(p.y).sub(5)))).mul(.75);
  const pools=max(max(pool(p,vec2(-11,0),vec2(5,3.4)),pool(p,vec2(12,2),vec2(4.5,3))),max(pool(p,vec2(-22,9),vec2(4,3.5)),pool(p,vec2(22,-8),vec2(4.5,3.5))));
  const lanes=max(max(freight,annex),max(galleries,max(inner,pools)));
  const warped=p.add(vec2(dampNoise(p.mul(.38)),dampNoise(p.mul(.38).add(19))).mul(.8));
  const shape=dampNoise(warped.mul(.34)).mul(.58).add(dampNoise(warped.mul(.97)).mul(.29)).add(dampNoise(p.mul(2.7)).mul(.13));
  return smoothstep(.34,.63,shape).mul(lanes);
});
