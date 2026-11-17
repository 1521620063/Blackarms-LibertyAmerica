import * as T from 'three/webgpu';
import { Fn, uniform, texture, vec2, vec3, vec4, float, Loop, If, mix, smoothstep, dot, max, min, sin, exp, getViewPosition, uv } from 'three/tsl';

// Depth-bounded ray marching with native shadow depth comparisons.
export function atmospherePass(view,worldPass){
  const inverseProjection=uniform(new T.Matrix4()),cameraWorld=uniform(new T.Matrix4());
  const density=uniform(.027),strength=uniform(.85),lampStrength=uniform(1.65),time=uniform(0),steps=uniform(24,'int'),enabled=uniform(1);
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
  const node=Fn(()=>{
    const screenUV=uv(),color=input.sample(screenUV).rgb.toVar();
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
          const falloff=float(1).div(length.mul(length).mul(.12).add(1));
          const fade=float(1).sub(smoothstep(lamp.range*.7,lamp.range,length));
          const phase=dot(direction,fromLamp.negate()).max(0).pow(4).mul(.65).add(.65);
          lamps.addAssign(lamp.tint.mul(cone).mul(falloff).mul(fade).mul(phase).mul(visibility(lamp,p)).mul(lamp.intensity));
        }
        scattering.addAssign(sun.add(lamps.mul(lampStrength)).mul(dust).mul(exp(travel.mul(density).negate())).mul(stepLength).mul(density));
      });
      color.mulAssign(exp(distance.mul(density).mul(-.055)));
      color.addAssign(vec3(.24,.3,.33).mul(float(1).sub(exp(distance.mul(-.002))))).addAssign(scattering);
    });
    return vec4(color,1);
  })();
  return {node,uniforms:{density,strength,lampStrength,time,inverseProjection,cameraWorld},bindings,steps,enabled,
    update(){
      inverseProjection.value.copy(view.camera.projectionMatrixInverse);cameraWorld.value.copy(view.camera.matrixWorld);
      for(const binding of bindings){
        binding.active.value=binding.light.shadow.autoUpdate?1:0;
        binding.matrix.value.copy(binding.light.shadow.matrix);
      }
      for(const lamp of lampBindings){lamp.direction.value.subVectors(lamp.light.target.position,lamp.light.position).normalize();lamp.intensity.value=lamp.light.intensity/130;}
    },dispose(){white.dispose();}
  };
}
