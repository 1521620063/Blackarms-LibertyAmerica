import * as T from 'three';

// Shared mechanical details, with a distinct silhouette and signal color per payload.
export function techThrowable(kit,type,root){
  const k=kit.armKit||kit,frag=type==='grenade',smoke=type==='smoke';
  const signal=frag?'fragSignal':smoke?'smokeSignal':'flashSignal';
  const shell=frag?'throwableOlive':'throwableCeramic',z=-.08;
  const box=(w,h,d,x,y,zz,mat='throwableFrame',r=.006,parent=root)=>k.box(parent,w,h,d,x,y,zz,mat,r);
  const tube=(r,h,y,mat='throwableFrame',sides=8,rt=r)=>k.cylinder(root,r,rt,h,0,y,z,mat,sides);
  const band=(radius,y,mat=signal,thickness=.003)=>{
    const mesh=k.mesh(k.geometry(`throwableBand:${radius}:${thickness}`,()=>new T.TorusGeometry(radius,thickness,6,32)),mat,root,0,y,z);
    mesh.rotation.x=Math.PI/2;return mesh;
  };
  const radial=(angle,radius,y,create)=>{
    const group=new T.Group();group.position.set(Math.sin(angle)*radius,y,z+Math.cos(angle)*radius);group.rotation.y=angle;root.add(group);create(group);return group;
  };
  const screw=(x,y,zz,parent=root)=>{
    const mesh=k.cylinder(parent,.004,.004,.004,x,y,zz,'titanium',6);mesh.rotation.x=Math.PI/2;
    return mesh;
  };

  if(frag){
    // Three rows of separate armor tiles expose a recessed orange arming spine.
    tube(.083,.255,-.025,'throwableRecess',8);
    for(const [row,y,radius] of [[0,-.12,.073],[1,-.045,.092],[2,.03,.083]]){
      for(let i=0;i<8;i++)radial(i*Math.PI/4,radius,y,g=>{
        box(.065,.066,.022,0,0,0,shell,.009,g);
        box(.046,.004,.004,0,-.021,.013,'throwableFrame',.001,g);
        if(row===1){box(.043,.004,.005,0,.023,.014,signal,.001,g);}
        if(i%2===0)screw(0,.015,.013,g);
      });
    }
    tube(.065,.028,-.168,'throwableFrame');
    tube(.066,.024,.083,'throwableFrame');
    band(.071,-.157,signal,.0025);band(.075,.073,signal,.0025);
    // A reinforced spine holds the recessed battery/status module.
    for(const side of [-1,1]){
      box(.024,.19,.025,side*.101,-.038,z,'throwableFrame',.005);
      for(let i=0;i<3;i++)box(.009,.012,.003,side*.102,-.085+i*.019,z+.014,signal,.001);
    }
  }else if(smoke){
    // A tall removable generator cartridge inside a pale six-rib exoskeleton.
    tube(.074,.285,-.025,'throwableRecess',12);
    tube(.077,.22,-.033,'throwableFrame',12);
    for(let i=0;i<6;i++)radial(i*Math.PI/3,.076,-.035,g=>{
      box(.041,.215,.027,0,0,0,shell,.008,g);
      box(.008,.146,.004,0,.012,.015,signal,.002,g);
      box(.029,.033,.032,0,-.104,.002,'throwableFrame',.004,g);
      for(let j=0;j<3;j++)box(.026,.004,.004,0,.064+j*.013,.016,'throwableRecess',.001,g);
    });
    for(const y of [-.172,.111]){
      tube(.098,.028,y,'throwableFrame',6);band(.087,y,signal,.0025);
    }
    tube(.066,.026,.137,shell,12);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      box(.012,.013,.024,Math.sin(a)*.048,.156,z+Math.cos(a)*.048,'throwableRecess',.002).rotation.y=a;
    }
    tube(.043,.018,-.195,shell,8);
  }else{
    // A squat optical core with open gaps between four shielding petals.
    const core=k.mesh(k.geometry('flashOpticalCore',()=>new T.IcosahedronGeometry(.088,1)),signal,root,0,-.025,z);
    core.scale.set(1,1.1,1);
    tube(.061,.06,-.142,'throwableFrame');tube(.06,.05,.093,'throwableFrame');
    for(const [y,tilt] of [[-.098,-.3],[.05,.3]]){
      for(let i=0;i<4;i++){
        const angle=Math.PI/4+i*Math.PI/2;
        radial(angle,.079,y,g=>{
          const petal=box(.098,.078,.024,0,0,0,shell,.011,g);petal.rotation.x=tilt;
          box(.056,.007,.005,0,0,.015,'throwableFrame',.002,g);
          screw(-.032,.021,.015,g);screw(.032,.021,.015,g);
        });
      }
    }
    // Continuous metal hoops protect the exposed luminous equator.
    band(.107,-.054,'throwableFrame',.007);band(.107,.004,'throwableFrame',.007);
    for(let i=0;i<8;i++)radial(i*Math.PI/4,.105,-.025,g=>{
      box(.012,.065,.014,0,0,0,'throwableFrame',.003,g);
      box(.006,.028,.003,0,0,.009,signal,.001,g);
    });
    band(.06,-.17,signal,.0025);
  }

  // Recessed electronic fuse, captive safety key and articulated thumb lever.
  const top=smoke?.176:frag?.112:.132;
  tube(.044,.033,top,'throwableFrame');tube(.027,.014,top+.022,'throwableRecess',12);
  tube(.018,.005,top+.032,signal,12);
  const hinge=k.cylinder(root,.011,.011,.068,0,top+.016,z+.014,'titanium',12);hinge.rotation.z=Math.PI/2;
  box(.027,.015,.11,.043,top+.038,z+.027,shell,.004).rotation.x=-.2;
  box(.028,.065,.018,.043,top+.01,z+.08,'throwableFrame',.004).rotation.x=-.25;
  const key=k.mesh(k.geometry('techSafetyKey',()=>new T.TorusGeometry(.023,.004,6,6)),'titanium',root,-.046,top+.025,z);
  key.rotation.y=Math.PI/2;key.rotation.z=Math.PI/6;
  box(.015,.008,.038,-.025,top+.023,z,'throwableFrame',.002);

  // Fine serial printing is cached with the other immutable weapon resources.
  const marking=k.geometry(`throwableSerial:${type}`,()=>{
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
    const c=canvas.getContext('2d');c.fillStyle='#162024';c.fillRect(0,0,256,128);
    c.fillStyle=frag?'#ffb267':smoke?'#73f0e5':'#d0b9ff';
    c.fillRect(12,12,5,104);c.font='bold 43px monospace';
    c.fillText(frag?'FG-01':smoke?'SG-02':'FB-03',30,56);
    c.fillStyle='#c0cbd0';c.font='17px monospace';c.fillText(frag?'FRAG / ARMED':smoke?'AEROSOL / GEN':'OPTICAL / PULSE',30,85);
    for(let i=0;i<31;i++)c.fillRect(30+i*6,98,i%3===0?3:1,15);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    return new T.MeshBasicMaterial({map,polygonOffset:true,polygonOffsetFactor:-1});
  });
  const labelY=smoke?-.035:frag?-.055:-.11,labelR=smoke?.096:frag?.12:.085;
  for(const side of [-1,1]){
    const plate=k.mesh(k.geometry('throwableSerialPlate',()=>new T.PlaneGeometry(.057,.029)),marking,root,side*labelR,labelY,z);
    plate.rotation.y=side*Math.PI/2;plate.castShadow=false;
  }
  root.userData.muzzle=new T.Vector3(0,.05,z);
  root.userData.design={grenade:'FG-01 / VECTOR',smoke:'SG-02 / VEIL',flash:'FB-03 / NOVA'}[type];
}
