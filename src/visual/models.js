import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Share immutable geometry across weapons, characters and scenery.
export class ModelKit {
  constructor(materials){this.materials=materials;this.geometries=new Map();this.reticleMaterial=new T.MeshBasicMaterial({color:0xff7258,toneMapped:false});}
  geometry(key,create){if(!this.geometries.has(key))this.geometries.set(key,create());return this.geometries.get(key);}
  mesh(geometry,material,parent,x=0,y=0,z=0){const mesh=new T.Mesh(geometry,typeof material==='string'?this.materials[material]:material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  box(parent,w,h,d,x,y,z,mat='steel',radius=0){
    const r=Math.min(radius,w*.22,h*.22,d*.22),key=`b:${w}:${h}:${d}:${r}`;
    return this.mesh(this.geometry(key,()=>r?new RoundedBoxGeometry(w,h,d,2,r):new T.BoxGeometry(w,h,d)),mat,parent,x,y,z);
  }
  cylinder(parent,r,rt,h,x,y,z,mat='steel',segments=16){return this.mesh(this.geometry(`c:${r}:${rt}:${h}:${segments}`,()=>new T.CylinderGeometry(r,rt,h,segments)),mat,parent,x,y,z);}
  sphere(parent,x,y,z,sx,sy,sz,mat='olive'){
    const mesh=this.mesh(this.geometry('sphere',()=>new T.SphereGeometry(1,20,14)),mat,parent,x,y,z);mesh.scale.set(sx,sy,sz);return mesh;
  }
  limb(parent,start,end,r,mat){
    const a=new T.Vector3(...start),b=new T.Vector3(...end),mesh=this.cylinder(parent,r,r*.88,a.distanceTo(b),0,0,0,mat,12);
    mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...end).sub(new T.Vector3(...start)).normalize());return mesh;
  }
  weapon(type,parent,firstPerson=false){
    const root=new T.Group();parent.add(root);const pistol=type==='pistol',scatter=type==='scatter';
    const b=(w,h,d,x,y,z,mat='dark',r=.012)=>this.box(root,w,h,d,x,y,z,mat,r);
    const barrel=(radius,length,z,y=0,mat='steel')=>{const m=this.cylinder(root,radius,radius,length,0,y,z,mat,20);m.rotation.x=Math.PI/2;return m;};
    if(pistol){
      b(.12,.115,.36,0,.018,-.08,'steel');b(.098,.09,.26,0,-.055,-.025,'dark');
      b(.094,.21,.13,0,-.17,.06,'rubber').rotation.x=-.27;
      b(.106,.025,.15,0,-.27,.09,'edge');b(.035,.025,.03,0,.09,-.23,'edge');b(.095,.032,.035,0,.087,.07,'dark');
      barrel(.027,.17,-.23,.02);barrel(.032,.045,-.32,.02,'edge');barrel(.019,.047,-.324,.02,'rubber');
      for(let i=0;i<8;i++){b(.123,.052,.006,0,.025,.015+i*.009,'rubber',0);}
      b(.008,.035,.065,.062,.01,-.06,'edge',.002);
      this.trigger(root,0,-.1,-.08,.075);
    }else{
      b(.135,.135,.32,0,.015,.025,'steel');b(.116,.095,.23,0,-.07,.04,'dark');
      b(.102,.205,.12,0,-.18,.14,'rubber').rotation.x=-.28;
      b(.105,.29,scatter?.15:.13,0,-.22,-.045,scatter?'olive':'steel').rotation.x=.12;
      b(.12,.025,.15,0,-.365,-.03,'rubber');
      for(let i=0;i<3;i++)b(.108,.17,.007,0,-.22,-.09+i*.025,'dark',.002);
      const length=scatter?.43:.34;
      b(.132,.125,length,0,.01,-.29,scatter?'olive':'dark');
      for(let i=0;i<8;i++){
        const z=-.15-i*.036;b(.137,.035,.018,0,.021,z,'rubber',.003);
        for(const side of [-1,1])b(.005,.019,.023,side*.069,-.024,z,'edge',.001);
      }
      barrel(scatter?.033:.021,scatter?.43:.28,scatter?-.57:-.55,.016,'edge');
      if(scatter)barrel(.028,.38,-.5,-.068,'dark');
      const end=scatter?-.82:-.73;barrel(scatter?.042:.032,.09,end,.016,'steel');
      barrel(scatter?.026:.018,.093,end-.003,.016,'rubber');
      for(let i=0;i<3;i++)b(.07,.012,.009,0,.047,end-.025+i*.024,'edge',0);
      barrel(.045,.21,.27,.015,'steel');
      b(.1,.15,.24,0,-.015,.38,'dark');b(.12,.21,.05,0,-.04,.51,'rubber');
      b(.09,.04,.2,0,.065,.36,'olive');
      for(let i=0;i<14;i++)b(.14,.019,.014,0,.093,.13-i*.033,'edge',.002);
      b(.08,.025,.13,0,.115,.035,'dark');b(.09,.015,.033,0,.196,-.015,'steel');b(.09,.015,.033,0,.118,-.015,'steel');
      b(.068,.06,.006,0,.157,-.035,'optic',.004);
      const reticle=this.sphere(root,0,.157,-.04,.0035,.0035,.002,this.reticleMaterial);reticle.castShadow=false;
      b(.018,.065,.035,-.058,.16,-.015,'dark');b(.018,.065,.035,.058,.16,-.015,'dark');
      b(.012,.042,.09,.073,.007,.018,'rubber');b(.014,.038,.055,.08,.026,.06,'edge');
      for(const z of [-.09,.12]){const pin=this.cylinder(root,.011,.011,.146,0,-.03,z,'edge',12);pin.rotation.z=Math.PI/2;}
      this.trigger(root,0,-.1,.06,.1);
      b(.008,.032,.095,.07,-.044,-.12,scatter?'orange':'blue',.002);
      // Small engraved serial plate rather than a glowing weapon body.
      for(let i=0;i<5;i++)b(.002,.009,.007,.070,.025,-.075+i*.012,'edge',0);
    }
    if(firstPerson){
      this.limb(root,[.13,-.33,.55],[.07,-.22,.11],.078,'olive');
      this.glove(root,.025,-.155,.09,.03);
      if(!pistol){this.limb(root,[-.32,-.31,.18],[-.11,-.14,-.3],.073,'olive');this.glove(root,-.055,-.1,-.29,-.55);}
    }
    root.userData.muzzle=new T.Vector3(0,.016,pistol?-.35:scatter?-.87:-.78);
    return root;
  }
  trigger(parent,x,y,z,size){
    this.box(parent,.018,.012,size,x-size*.35,y-.05,z,'steel',.003);
    for(const dz of [-size*.45,size*.45])this.box(parent,.018,.06,.012,x-size*.35,y-.023,z+dz,'steel',.002);
    this.box(parent,.015,.044,.013,x-size*.35,y-.016,z,'rubber',.003).rotation.x=-.25;
  }
  glove(parent,x,y,z,rotation){
    const hand=new T.Group();hand.position.set(x,y,z);hand.rotation.z=rotation;parent.add(hand);
    this.box(hand,.113,.085,.14,0,0,0,'rubber',.025);this.box(hand,.095,.025,.085,0,.046,0,'armor',.012);
    for(let i=0;i<4;i++){this.box(hand,.022,.06,.05,-.039+i*.026,-.03,-.045,'rubber',.009);this.box(hand,.021,.02,.03,-.039+i*.026,.041,-.03,'steel',.005);}
    this.box(hand,.043,.045,.075,.065,-.015,.015,'rubber',.015).rotation.z=-.35;
    return hand;
  }
}
