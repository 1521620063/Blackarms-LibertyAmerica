import * as T from 'three/webgpu';
import { Fn, uniform, texture, rtt, vec2, vec3, vec4, float, Loop, If, mix, smoothstep, dot, max, min, sin, exp, abs, floor, fract, getViewPosition, uv } from 'three/tsl';

import { renderEffectScale } from './performance.js';

// Depth-bounded ray marching with native shadow depth comparisons.
export function atmospherePass(view,worldPass){
  const inverseProjection=uniform(new T.Matrix4()),cameraWorld=uniform(new T.Matrix4());
  const density=uniform(.027),strength=uniform(.85),lampStrength=uniform(1.65),time=uniform(0),steps=uniform(16,'int'),enabled=uniform(1);
  const white=new T.DepthTexture(1,1);white.compareFunction=T.LessCompare;
  const lights=[view.sun,...view.localShadowLights];
  const bindings=lights.map(light=>({light,matrix:uniform(new T.Matrix4()),map:texture(white).onRenderUpdate(()=>light.shadow.map?.depthTexture||white),active:uniform(0)}));
  const visibility=(binding,p)=>{
    const projected=binding.matrix.mul(vec4(p,1)),q=projected.xyz.div(projected.w);
    const coord=vec3(q.x,float(1).sub(q.y),q.z.mul(2).sub(1).sub(.0002));
    const inside=coord.greaterThanEqual(vec3(0)).all().and(coord.lessThanEqual(vec3(1)).all());
    return inside.select(binding.map.sample(coord.xy).compare(coord.z),float(0)).mul(binding.active);
  };
  const lampBindings=view.localShadowLights.map((light,index)=>({
    ...bindings[index+1],position:uniform(light.position),direction:uniform(light.target.position.clone().sub(light.position).normalize()),tint:uniform(light.color),intensity:uniform(0),range:Math.min(light.distance,7),cone:Math.cos(light.angle)
  }));
  const input=worldPass.getTextureNode(),depth=worldPass.getTextureNode('depth');
  const texel=uniform(new T.Vector2(1,1));
  // Only scattering is evaluated at reduced resolution. Keep scene color and
  // extinction at native resolution so silhouettes and weapon detail stay sharp.
  const scatteringPass=rtt(Fn(()=>{
    const screenUV=uv();
    const end=cameraWorld.mul(vec4(getViewPosition(screenUV,depth.sample(screenUV).r,inverseProjection),1)).xyz;
    const origin=cameraWorld.mul(vec4(0,0,0,1)).xyz,offset=end.sub(origin),direction=offset.normalize();
    const distance=min(offset.length(),42),stepLength=distance.div(float(steps)),scattering=vec3(0).toVar();
    const jitter=dot(screenUV,vec2(12.9898,78.233)).sin().mul(43758.5453).fract();
    const phase=dot(direction,uniform(view.sun.position.clone().normalize())).max(0).pow(5).mul(.8).add(.7);
    If(enabled.greaterThan(.5),()=>{
      Loop({start:0,end:steps,type:'int'},({i})=>{
        const travel=float(i).add(jitter).mul(stepLength),p=origin.add(direction.mul(travel));
        const dust=mix(1,.72,smoothstep(0,5.6,p.y)).mul(sin(p.x.mul(1.7).add(p.z.mul(.9)).add(p.y.mul(2.3).sin()).add(time.mul(.12))).mul(.1).add(.9));
        const sun=vec3(1,.745,.462).mul(visibility(bindings[0],p)).mul(strength).mul(phase),lamps=vec3(0).toVar();
        for(const lamp of lampBindings){
          const delta=p.sub(lamp.position),length=delta.length(),fromLamp=delta.div(max(length,.001));
          const cone=smoothstep(lamp.cone,lamp.cone+(1-lamp.cone)*.45,dot(fromLamp,lamp.direction));
          // Most samples lie outside a lamp's short cone. Avoid a shadow-map
          // comparison there, and skip unused quality-tier lights entirely.
          If(lamp.active.greaterThan(.5).and(lamp.intensity.greaterThan(0)).and(length.lessThan(lamp.range)).and(cone.greaterThan(0)),()=>{
            const falloff=float(1).div(length.mul(length).mul(.12).add(1));
            const fade=float(1).sub(smoothstep(lamp.range*.7,lamp.range,length));
            const phase=dot(direction,fromLamp.negate()).max(0).pow(4).mul(.65).add(.65);
            lamps.addAssign(lamp.tint.mul(cone).mul(falloff).mul(fade).mul(phase).mul(visibility(lamp,p)).mul(lamp.intensity));
          });
        }
        scattering.addAssign(sun.add(lamps.mul(lampStrength)).mul(dust).mul(exp(travel.mul(density).negate())).mul(stepLength).mul(density));
      });
    });
    return vec4(scattering,distance);
  })(),1,1,{type:T.HalfFloatType,depthBuffer:false});
  const node=Fn(()=>{
    const screenUV=uv(),color=input.sample(screenUV).rgb.toVar();
    If(enabled.greaterThan(.5),()=>{
      const distance=min(getViewPosition(screenUV,depth.sample(screenUV).r,inverseProjection).length(),42);
      const grid=screenUV.div(texel).sub(.5),base=floor(grid).add(.5).mul(texel),fraction=fract(grid);
      const scattering=vec3(0).toVar(),total=float(0).toVar();
      // Depth-aware bilinear upsampling avoids leaking light across nearby walls.
      for(const [x,y] of [[0,0],[1,0],[0,1],[1,1]]){
        const sample=scatteringPass.sample(base.add(texel.mul(vec2(x,y))));
        const bilinear=(x?fraction.x:float(1).sub(fraction.x)).mul(y?fraction.y:float(1).sub(fraction.y));
        const weight=bilinear.div(abs(sample.a.sub(distance)).mul(16).add(1));
        scattering.addAssign(sample.rgb.mul(weight));total.addAssign(weight);
      }
      color.mulAssign(exp(distance.mul(density).mul(-.055)));
      color.addAssign(vec3(.24,.3,.33).mul(float(1).sub(exp(distance.mul(-.002))))).addAssign(scattering.div(max(total,1e-5)));
    });
    return vec4(color,1);
  })();
  return {node,scatteringPass,uniforms:{density,strength,lampStrength,time,inverseProjection,cameraWorld},bindings,steps,enabled,
    resize(width,height,quality){
      const scale=renderEffectScale(width,height,quality),w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
      if(scatteringPass.width!==w||scatteringPass.height!==h)scatteringPass.setSize(w,h);
      texel.value.set(1/w,1/h);
    },
    update(){
      inverseProjection.value.copy(view.camera.projectionMatrixInverse);cameraWorld.value.copy(view.camera.matrixWorld);
      for(const binding of bindings){
        // Cached maps still illuminate the fog between shadow updates.
        binding.active.value=binding.light.castShadow&&binding.light.shadow.intensity>0&&binding.light.shadow.map?1:0;
        binding.matrix.value.copy(binding.light.shadow.matrix);
      }
      for(const lamp of lampBindings){lamp.direction.value.subVectors(lamp.light.target.position,lamp.light.position).normalize();lamp.intensity.value=lamp.light.intensity/130;}
    },dispose(){white.dispose();scatteringPass.renderTarget.dispose();}
  };
}
