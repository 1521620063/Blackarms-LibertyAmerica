import { Color, PassNode } from 'three/webgpu';
import { nodeObject } from 'three/tsl';

// Postprocessing nodes can evaluate their input scene passes while the renderer
// has an opaque black clear color (SMAA resets it this way). An overlay must own
// its clear state instead of inheriting the state of its consumer.
class TransparentPassNode extends PassNode {
  constructor(scene,camera,options){
    super(PassNode.COLOR,scene,camera,options);
    this.clearColor=new Color();
  }
  updateBefore(frame){
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
