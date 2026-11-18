import { Color, PassNode } from 'three/webgpu';
import { nodeObject, vec4 } from 'three/tsl';

// Render targets already contain alpha-weighted surface colors plus additive
// light. Preserve that light even where the overlay's coverage is zero.
export const compositeOverlay=(background,overlay,visible)=>vec4(background.rgb.mul(overlay.a.mul(visible).oneMinus()).add(overlay.rgb.mul(visible)),1);

// Postprocessing nodes can evaluate their input scene passes while the renderer
// has an opaque black clear color (SMAA resets it this way). An overlay must own
// its clear state instead of inheriting the state of its consumer.
class TransparentPassNode extends PassNode {
  constructor(scene,camera,options){
    super(PassNode.COLOR,scene,camera,options);
    this.clearColor=new Color();
    this.isActive=()=>true;
  }
  updateBefore(frame){
    if(!this.isActive())return;
    const {renderer}=frame;
    renderer.getClearColor(this.clearColor);
    const alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
    try{
      renderer.setClearColor(0x000000,0);renderer.autoClear=true;
      super.updateBefore(frame);
    }finally{
      renderer.setClearColor(this.clearColor,alpha);renderer.autoClear=autoClear;
    }
  }
}

export const transparentPass=(scene,camera,options)=>nodeObject(new TransparentPassNode(scene,camera,options));
