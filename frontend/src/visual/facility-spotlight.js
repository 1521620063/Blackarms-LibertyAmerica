import { SpotLight, SpotLightNode } from 'three/webgpu';
import { getDistanceAttenuation, lightTargetDirection } from 'three/tsl';

export class FacilitySpotLight extends SpotLight {}

// Unmapped facility lamps use the stock spotlight falloff and material BRDF.
// Skip the BRDF entirely where that falloff is exactly zero.
class FacilitySpotLightNode extends SpotLightNode {
  setup(builder){
    const {light,colorNode,coneCosNode,cutoffDistanceNode,decayExponentNode}=this;
    if(light.castShadow||this.shadowNode||light.map||light.colorNode){super.setup(builder);return;}
    const vector=this.getLightVector(builder).toVar();
    const lightDirection=vector.normalize().toVar();
    const angle=lightDirection.dot(lightTargetDirection(light)).toVar();
    const lightDistance=vector.length().toVar();
    const inRange=cutoffDistanceNode.lessThanEqual(0).or(lightDistance.lessThan(cutoffDistanceNode));
    builder.stack.If(angle.greaterThan(coneCosNode).and(inRange),()=>{
      const spot=this.getSpotAttenuation(builder,angle);
      const attenuation=getDistanceAttenuation({lightDistance,cutoffDistance:cutoffDistanceNode,decayExponent:decayExponentNode});
      const lightColor=colorNode.mul(spot).mul(attenuation);
      builder.lightsNode.setupDirectLight(builder,this,{lightColor,lightDirection});
    });
  }
}

export const registerFacilitySpotLight=renderer=>renderer.library.addLight(FacilitySpotLightNode,FacilitySpotLight);
