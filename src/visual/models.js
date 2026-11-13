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
      this.primaryWeapon(root,scatter,b,barrel);
    }
    if(firstPerson){
      this.limb(root,[.13,-.33,.55],[.07,-.22,.11],.078,'olive');
      this.glove(root,.025,-.155,.09,.03);
      if(!pistol){this.limb(root,[-.32,-.31,.18],[-.11,-.14,-.3],.073,'olive');this.glove(root,-.055,-.1,-.29,-.55);}
    }
    root.userData.muzzle=new T.Vector3(0,.016,pistol?-.35:scatter?-.855:-.83);
    root.userData.design=pistol?'EP-12':scatter?'SG-6 BREACHER':'PR-24 KESTREL';
    return root;
  }
  primaryWeapon(root,scatter,b,barrel){
    const shell=scatter?'gunmetal':'cerakote';
    const profile=(key,width,points,mat)=>{
      const geometry=this.geometry(key,()=>{
        const shape=new T.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(-z,y):shape.moveTo(-z,y));shape.closePath();
        const g=new T.ExtrudeGeometry(shape,{depth:width-.008,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.004,bevelThickness:.004});
        g.rotateY(Math.PI/2);g.translate(-width/2+.004,0,0);return g;
      });
      return this.mesh(geometry,mat,root);
    };
    // Sculpted receiver with sloping shoulders, rather than a rectangular slab.
    profile(`receiver:${scatter}`,.146,[[.18,-.045],[.18,.04],[.13,.079],[-.13,.079],[-.17,.046],[-.17,-.035],[-.09,-.064],[.10,-.064]],shell);
    b(.124,.065,.255,0,-.078,.035,'gunmetal');
    b(.125,.035,.32,0,.083,.01,'gunmetal',.006);
    b(.009,.044,.108,.076,.016,-.012,'rubber',.004);
    b(.012,.025,.071,.082,.013,-.005,'titanium',.003);
    b(.014,.018,.1,.082,.05,-.006,shell,.003).rotation.z=-.18;
    b(.027,.016,.035,-.09,.033,.07,'titanium',.004);
    b(.052,.025,.026,-.106,.033,.07,'carbon',.004);
    for(const side of [-1,1]){
      for(const z of [-.12,.105]){
        const screw=this.cylinder(root,.009,.009,.008,side*.077,-.027,z,'titanium',6);screw.rotation.z=Math.PI/2;
        b(.002,.002,.01,side*.082,-.027,z,'rubber',0);
      }
      b(.006,.027,.078,side*.074,-.051,.04,'carbon',.003);
      b(.009,.01,.027,side*.08,-.047,.064,'weaponAccent',.002).rotation.x=-.35;
    }
    // Angled grip with an inset backstrap and raised grip texture.
    b(.091,.19,.107,0,-.18,.13,'carbon',.018).rotation.x=-.32;
    b(.099,.026,.119,0,-.275,.16,'rubber',.007);
    for(let i=0;i<6;i++)b(.094,.008,.081,0,-.121-i*.022,.11+i*.007,'rubber',.002).rotation.x=-.32;
    this.trigger(root,0,-.1,.021,.1);
    if(scatter){
      // Breacher: bulky heat shield, exposed twin tubes and a compact box magazine.
      b(.162,.142,.305,0,.005,-.303,'gunmetal',.022);
      b(.145,.046,.32,0,.078,-.29,'titanium',.008);
      barrel(.038,.54,-.52,.016,'titanium');
      barrel(.028,.43,-.48,-.077,'gunmetal');
      barrel(.038,.035,-.693,-.077,'weaponAccent');
      b(.176,.073,.19,0,-.073,-.333,'carbon',.017);
      for(let i=0;i<7;i++)b(.18,.069,.012,0,-.072,-.255-i*.024,'rubber',.003);
      for(const side of [-1,1])for(let i=0;i<5;i++){
        b(.006,.028,.034,side*.083,.016,-.2-i*.047,'rubber',.006);
        b(.009,.008,.033,side*.085,-.003,-.2-i*.047,'edge',.002);
      }
      b(.113,.217,.156,0,-.189,-.058,'gunmetal',.018).rotation.x=.08;
      b(.127,.035,.171,0,-.3,-.049,'carbon',.006);
      for(const side of [-1,1])for(let i=0;i<3;i++)b(.009,.13,.011,side*.059,-.2,-.102+i*.041,'titanium',.002);
      barrel(.052,.104,-.794,.016,'gunmetal');
      for(let i=0;i<3;i++)barrel(.055,.009,-.758-i*.027,.016,'titanium');
      barrel(.034,.004,-.848,.016,'rubber');
      for(const side of [-1,1])for(let i=0;i<3;i++)b(.005,.022,.012,side*.05,.016,-.77-i*.025,'rubber',.002);
      // Shell carrier on the visible side of the receiver.
      for(let i=0;i<4;i++){
        const shell=this.cylinder(root,.012,.012,.068,-.093,-.005,.055+i*.026,'weaponAccent',12);
        shell.rotation.x=.12;
        const cap=this.cylinder(root,.013,.013,.012,-.093,.035,.05+i*.026,'brass',12);cap.rotation.x=.12;
      }
    }else{
      // Kestrel: long free-floating handguard with recessed M-LOK slots.
      profile('kestrelHandguard',.128,[[-.134,-.039],[-.15,.06],[-.458,.06],[-.49,.025],[-.49,-.025],[-.46,-.05],[-.18,-.05]],shell);
      b(.106,.028,.37,0,.074,-.311,'gunmetal',.004);
      b(.088,.025,.325,0,-.06,-.3,'carbon',.006);
      barrel(.022,.48,-.46,.016,'titanium');
      for(const side of [-1,1])for(let i=0;i<6;i++){
        const z=-.18-i*.048;
        b(.006,.025,.031,side*.065,.015,z,'rubber',.006);
        b(.008,.006,.026,side*.066,-.002,z,'titanium',.002);
        b(.006,.013,.027,side*.061,.05,z,'rubber',.003);
      }
      b(.058,.1,.072,0,-.107,-.315,'carbon',.01).rotation.x=-.3;
      b(.083,.032,.1,0,-.072,-.319,'gunmetal',.004);
      // Curved magazine assembled from angled sections.
      b(.096,.135,.127,0,-.144,-.063,'gunmetal',.012).rotation.x=.12;
      b(.096,.13,.126,0,-.264,-.038,'gunmetal',.012).rotation.x=.3;
      b(.108,.026,.143,0,-.326,-.018,'carbon',.006).rotation.x=.3;
      for(const side of [-1,1])for(let i=0;i<3;i++){
        b(.006,.11,.008,side*.05,-.15,-.101+i*.035,'titanium',.002).rotation.x=.12;
        b(.006,.101,.008,side*.05,-.265,-.075+i*.035,'carbon',.002).rotation.x=.3;
      }
      barrel(.029,.12,-.696,.016,'gunmetal');
      barrel(.036,.09,-.78,.016,'titanium');
      barrel(.022,.004,-.827,.016,'rubber');
      for(const side of [-1,1])for(let i=0;i<3;i++)b(.005,.022,.012,side*.035,.016,-.755-i*.022,'rubber',.002);
    }
    // Adjustable skeleton stock: two struts leave a real opening in the silhouette.
    barrel(.028,.18,.258,.016,'titanium');
    b(.115,.044,.245,0,.047,.347,shell,.01);
    b(.082,.032,.218,0,-.086,.357,'gunmetal',.006).rotation.x=.12;
    b(.093,.12,.043,0,-.021,.442,shell,.009).rotation.x=-.16;
    b(.126,.184,.037,0,-.035,.479,'rubber',.009);
    b(.09,.024,.15,0,.078,.352,'carbon',.007);
    for(let i=0;i<5;i++)b(.129,.008,.04,0,-.103+i*.032,.481,'carbon',.002);
    // Continuous rail and open-window reflex optic, aligned to the ADS camera.
    for(let i=0;i<20;i++)b(.098,.009,.012,0,.1,.14-i*.031,'gunmetal',.002);
    b(.085,.021,.108,0,.117,.021,'titanium',.004);
    const optic=new T.Group();root.add(optic);optic.position.set(0,.157,-.012);
    const hood=this.geometry('reflexHood',()=>{
      const polygon=(points)=>{const path=new T.Shape();points.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();return path;};
      const shape=polygon([[-.055,-.035],[.055,-.035],[.055,.028],[.037,.049],[-.037,.049],[-.055,.028]]);
      shape.holes.push(polygon([[-.039,-.023],[-.039,.022],[-.027,.034],[.027,.034],[.039,.022],[.039,-.023]]));
      const g=new T.ExtrudeGeometry(shape,{depth:.043,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.003,bevelThickness:.003});g.translate(0,0,-.025);return g;
    });
    this.mesh(hood,shell,optic);
    this.box(optic,.078,.061,.004,0,.004,-.022,'optic',.002);
    const reticle=this.sphere(optic,0,0,-.026,.0025,.0025,.001,this.reticleMaterial);reticle.castShadow=false;
    const dial=this.cylinder(optic,.019,.019,.019,.066,-.009,.009,'carbon',16);dial.rotation.z=Math.PI/2;
    // Fine receiver markings use a shared texture rather than extra geometry.
    const marking=this.geometry(`marking:${scatter}`,()=>{
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
      const c=canvas.getContext('2d');c.fillStyle=scatter?'#bec7ca':'#333b3d';
      c.font='bold 42px monospace';c.fillText(scatter?'SG-6 / BREACHER':'PR-24 / KESTREL',12,50);
      c.font='19px monospace';c.fillText(scatter?'12 GA  //  006':'5.56 NATO  //  024',14,88);
      const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
      return new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    });
    for(const side of [-1,1]){
      const plate=this.mesh(this.geometry('weaponMarkPlane',()=>new T.PlaneGeometry(.145,.036)),marking,root,side*.0745,.042,.045);
      plate.rotation.y=side*Math.PI/2;plate.castShadow=false;
    }
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
