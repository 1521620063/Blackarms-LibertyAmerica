import * as T from 'three';

// Render only on selection / drag; the equipment preview has no animation loop.
export class WeaponPreview {
  constructor(canvas,kit){
    this.kit=kit;this.canvas=canvas;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});
    this.renderer.setSize(640,300,false);this.renderer.setPixelRatio(1);
    this.renderer.toneMapping=T.ACESFilmicToneMapping;
    this.scene=new T.Scene();this.scene.add(new T.HemisphereLight(0xd8ecff,0x6e7158,3));
    const key=new T.DirectionalLight(0xffe2b8,4);key.position.set(-2,3,2);this.scene.add(key);
    const rim=new T.DirectionalLight(0x82bfe6,3);rim.position.set(2,1,-2);this.scene.add(rim);
    this.camera=new T.PerspectiveCamera(33,640/300,.01,10);this.camera.position.set(-1.65,.56,1.05);this.camera.lookAt(0,-.05,-.2);
    this.pivot=new T.Group();this.scene.add(this.pivot);this.drag=null;
    canvas.addEventListener('pointerdown',e=>{this.drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{
      if(!this.drag)return;
      this.pivot.rotation.y+=(e.clientX-this.drag.x)*.009;
      this.pivot.rotation.x=T.MathUtils.clamp(this.pivot.rotation.x+(e.clientY-this.drag.y)*.005,-.5,.5);
      this.drag={x:e.clientX,y:e.clientY};this.render();
    });
    const end=()=>{this.drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
  }
  select(type){
    if(this.weapon)this.pivot.remove(this.weapon);
    this.weapon=this.kit.weapon(type,this.pivot);this.pivot.rotation.set(-.08,-.5,0);
    this.render();
  }
  render(){this.renderer.render(this.scene,this.camera);}
}
