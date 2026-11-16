import { Fn, uniform, vec2, float, texture, textureLoad, ivec2, Loop, If, sin, cos, fract, dot, floor, max, abs, dFdx, dFdy } from 'three/tsl';
import { Vector2 } from 'three/webgpu';

// Contact-hardening sun shadows sampled from WebGPU depth textures.
export function facilitySunShadows(view){
  const camera=view.sun.shadow.camera;
  const span=uniform(new Vector2(camera.right-camera.left,camera.top-camera.bottom));
  const depthRange=camera.far-camera.near,taps=uniform(16,'int');
  view.sun.shadow.filterNode=Fn(({depthTexture,shadowCoord,shadow})=>{
    const sc=shadowCoord,texel=vec2(1).div(uniform(shadow.mapSize));
    const dx=dFdx(sc),dy=dFdy(sc),det=dx.x.mul(dy.y).sub(dx.y.mul(dy.x));
    const slope=vec2(0).toVar();
    If(abs(det).greaterThan(1e-12),()=>{slope.assign(vec2(dy.y.mul(dx.z).sub(dx.y.mul(dy.z)),dx.x.mul(dy.z).sub(dy.x.mul(dx.z))).div(det).clamp(-6,6));});
    const receiver=sc.z.sub(dot(abs(slope),texel).mul(.35));
    const phase=fract(dot(floor(sc.xy.div(texel)),vec2(12.9898,78.233)).sin().mul(43758.5453)).mul(Math.PI*2);
    const disk=(i,count,angle)=>{const r=float(i).add(.5).div(count).sqrt(),a=float(i).mul(2.39996323).add(angle);return vec2(cos(a),sin(a)).mul(r);};
    const blockers=float(0).toVar(),sum=float(0).toVar(),result=float(1).toVar();
    Loop(8,({i})=>{
      const offset=disk(i,8,phase).mul(.28).div(span),uv=sc.xy.add(offset).clamp(texel,vec2(1).sub(texel));
      const depth=textureLoad(depthTexture,ivec2(uv.mul(uniform(shadow.mapSize)))).r;
      If(depth.lessThan(receiver.add(dot(offset,slope))),()=>{sum.addAssign(depth);blockers.addAssign(1);});
    });
    If(blockers.greaterThan(.5),()=>{
      const separation=max(receiver.sub(sum.div(blockers)),0).mul(depthRange);
      const radius=max(vec2(separation.mul(.022).clamp(.012,.24)).div(span),texel.mul(1.1)),lit=float(0).toVar();
      Loop({start:0,end:taps,type:'int'},({i})=>{
        const offset=disk(i,float(taps),phase.add(1.7)).mul(radius),uv=sc.xy.add(offset).clamp(texel,vec2(1).sub(texel));
        lit.addAssign(texture(depthTexture,uv).compare(receiver.add(dot(offset,slope))));
      });
      result.assign(lit.div(float(taps)));
    });
    return result;
  });
  return {facilityShadowTaps:taps};
}
