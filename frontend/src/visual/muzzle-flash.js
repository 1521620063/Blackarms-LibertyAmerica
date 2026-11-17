import * as T from 'three/webgpu';
import { Fn, attribute, uv, uniform, vec3, vec4, float, If, mix, smoothstep, exp, sin, cos, atan, abs } from 'three/tsl';

// Demo-inspired crossed flame sheets: a white core, irregular petals and side jets.
export function createMuzzleFlash(){
  const positions=[],uvs=[],types=[];
  function quad(points,type){for(const index of [0,1,2,0,2,3]){positions.push(...points[index]);uvs.push(...[[0,0],[1,0],[1,1],[0,1]][index]);types.push(type);}}
  quad([[-.13,-.13,-.025],[.13,-.13,-.025],[.13,.13,-.025],[-.13,.13,-.025]],0);
  quad([[-.065,0,0],[.065,0,0],[.065,0,-.34],[-.065,0,-.34]],1);
  quad([[0,-.065,0],[0,.065,0],[0,.065,-.34],[0,-.065,-.34]],1);
  quad([[-.18,-.045,-.015],[.18,-.045,-.015],[.18,.045,-.015],[-.18,.045,-.015]],2);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('kind',new T.Float32BufferAttribute(types,1));
  const intensity=uniform(0),seed=uniform(0);
  const material=new T.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneFactor,blendEquation:T.AddEquation,blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor});
  material.uniforms={intensity,seed};
  material.fragmentNode=Fn(()=>{
    const coords=uv(),p=coords.mul(2).sub(1),r=p.length(),kind=attribute('kind','float'),f=float(0).toVar();
    If(kind.lessThan(.5),()=>{
      const a=atan(p.y,p.x).add(seed),petals=abs(cos(a.mul(2.5))).pow(7).add(abs(sin(a.mul(4))).pow(12).mul(.4)),reach=petals.mul(.65).add(.3);
      f.assign(float(1).sub(smoothstep(reach.mul(.12),reach,r)).mul(petals.add(.25)).add(exp(r.mul(r).mul(-55)).mul(2)));
    }).ElseIf(kind.lessThan(1.5),()=>{
      const y=coords.y.clamp(0,1),x=p.x.add(sin(y.mul(23).add(seed)).mul(.12).mul(y)),width=sin(y.mul(Math.PI)).mul(.24).add(.18);
      f.assign(exp(x.mul(x).negate().div(width.mul(width))).mul(float(1).sub(y).pow(1.7)).mul(sin(y.mul(35).add(seed)).mul(.25).add(1)));
    }).Else(()=>{
      const x=abs(p.x);f.assign(exp(p.y.mul(p.y).negate().mul(x.mul(25).add(18))).mul(float(1).sub(smoothstep(.1,.95,x))).mul(smoothstep(.02,.15,x)).mul(.65));
    });
    const energy=f.max(0).mul(intensity.max(0));energy.lessThan(.001).discard();
    return vec4(mix(vec3(1,.26,.035),vec3(1,.88,.6),f.clamp(0,1)).mul(energy),0);
  })();
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;return mesh;
}
export const muzzleScale=type=>({pistol:.65,smg:.7,rifle:1,dmr:1.15,lmg:1.2,scatter:1.5,sniper:1.6}[type]||1);
