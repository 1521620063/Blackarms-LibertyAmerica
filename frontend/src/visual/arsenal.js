import * as T from 'three';

// Original silhouettes; shared construction helpers keep immutable meshes cached.
export function expandedWeapon(kit,type,root){
  const smg=type==='smg',dmr=type==='dmr',lmg=type==='lmg',sniper=type==='sniper';
  const shell=sniper?'armor':dmr?'cerakote':lmg?'titanium':'gunmetal';
  const b=(w,h,d,x,y,z,mat='gunmetal',r=.008)=>kit.box(root,w,h,d,x,y,z,mat,r);
  const tube=(r,len,z,y=.016,mat='titanium',x=0,parent=root)=>{
    const m=kit.cylinder(parent,r,r,len,x,y,z,mat,20);m.rotation.x=Math.PI/2;return m;
  };
  const receiverLength=smg?.27:lmg?.43:.35,width=lmg?.18:.13;
  b(width,.125,receiverLength,0,.008,.015,shell,.022);
  b(width*.86,.055,receiverLength*.82,0,-.079,.018,'gunmetal');
  b(.087,.185,.102,0,-.18,.135,'carbon',.015).rotation.x=-.25;
  for(let i=0;i<5;i++)b(.09,.008,.085,0,-.12-i*.026,.123+i*.006,'rubber',.002);
  b(.1,.025,.12,0,-.277,.16,'rubber');kit.trigger(root,0,-.1,.025,.09);
  for(const side of [-1,1]){
    for(const z of [-.09,.1]){const pin=kit.cylinder(root,.009,.009,.009,side*(width/2+.002),-.026,z,'titanium',6);pin.rotation.z=Math.PI/2;}
    b(.006,.018,.034,side*(width/2+.004),-.052,.06,'weaponAccent',.003);
    // Receiver insignia and a short engraved serial strip.
    for(let i=0;i<5;i++)b(.002,.01,.004,side*(width/2+.001),.034,.05+i*.01,'edge',0);
  }
  const front=smg?-.48:sniper?-1.08:dmr?-.89:-.86;
  tube(smg?.023:sniper?.031:.026,Math.abs(front)-.08,(front-.08)/2);
  if(smg){
    // Compact monolithic upper, cooling vents, straight magazine and wire stock.
    b(.119,.104,.22,0,.002,-.215,'gunmetal',.018);
    for(const side of [-1,1])for(let i=0;i<5;i++)b(.006,.027,.019,side*.061,.011,-.145-i*.034,'rubber',.005);
    b(.058,.257,.08,0,-.229,-.076,'carbon',.009).rotation.x=.09;
    b(.071,.022,.094,0,-.357,-.064,'weaponAccent');
    for(const side of [-1,1])for(let i=0;i<3;i++)b(.003,.17,.006,side*.03,-.231,-.097+i*.022,'titanium',.001);
    b(.07,.08,.05,0,-.09,-.274,'carbon').rotation.x=-.3;
    for(const side of [-1,1])tube(.011,.24,.27,.025,'titanium',side*.042);
    b(.085,.145,.028,0,-.023,.396,'rubber');
    tube(.037,.11,-.49,.016,'gunmetal');tube(.022,.004,-.547,.016,'rubber');
  }else{
    const guardLength=sniper?.42:dmr?.39:.35,guardZ=sniper?-.39:dmr?-.37:-.4;
    b(lmg?.172:.127,.106,guardLength,0,-.008,guardZ,shell,.02);
    for(const side of [-1,1])for(let i=0;i<7;i++){
      const z=guardZ+guardLength/2-.032-i*(guardLength-.06)/7;
      b(.006,.025,.024,side*(lmg?.087:.065),.005,z,'rubber',.005);
      b(.008,.006,.024,side*(lmg?.088:.066),-.016,z,'edge',.001);
    }
    if(lmg){
      // Broad box magazine, exposed belt links and offset carry handle.
      b(.216,.205,.215,-.025,-.196,-.067,'armor',.022);
      b(.232,.027,.23,-.025,-.302,-.067,'rubber');
      for(let i=0;i<5;i++){
        const x=-.13+i*.027;
        tube(.013,.065,-.014,-.051-i*.002,'brass',x);
        b(.019,.016,.023,x,-.036-i*.002,-.018,'gunmetal',.002);
      }
      b(.022,.09,.022,-.105,.116,-.115,'gunmetal');
      b(.022,.09,.022,-.105,.116,-.285,'gunmetal');
      b(.028,.028,.19,-.105,.166,-.2,'carbon');
      b(.14,.043,.31,0,.045,.35,'armor');b(.115,.085,.23,0,-.037,.37,'armor',.019);
      b(.142,.18,.037,0,-.03,.5,'rubber');
    }else{
      // Short precision magazine and adjustable skeleton stock.
      b(.092,sniper?.10:.155,.12,0,sniper?-.142:-.17,-.052,'gunmetal',.009);
      b(.104,.023,.134,0,sniper?-.195:-.253,-.052,'carbon');
      tube(.023,.21,.28,.016,'titanium');
      b(.105,.033,.24,0,.042,.36,shell);b(.064,.027,.21,0,-.087,.37,'titanium');
      b(.088,.14,.037,0,-.02,.467,shell);b(.115,.185,.033,0,-.036,.49,'rubber');
      b(.104,.029,.145,0,.08,.37,'carbon');
      for(const z of [.325,.405])b(.018,.042,.023,0,.053,z,'titanium');
    }
    // Folded bipod legs read clearly along the sides of the long barrel.
    for(const side of [-1,1]){
      const leg=b(.018,.028,sniper?.32:.24,side*.083,-.067,sniper?-.66:-.57,'gunmetal',.005);leg.rotation.y=side*.045;
      b(.032,.04,.04,side*.09,-.066,sniper?-.81:-.68,'rubber');
    }
    tube(sniper?.045:.036,sniper?.15:.1,front-.025,.016,'gunmetal');
    for(let i=0;i<3;i++)tube(sniper?.047:.038,.008,front+.025-i*.031);
    tube(sniper?.028:.021,.004,front-(sniper?.102:.077),.016,'rubber');
  }
  const railEnd=smg?-.32:sniper?-.51:-.49;
  for(let z=.14;z>railEnd;z-=.031)b(.095,.01,.012,0,.084,z,'gunmetal',.002);
  if(dmr||sniper){
    // A proper tube scope with objective bell, mount rings and adjustment turrets.
    const scopeY=.17,scopeZ=sniper?-.095:-.065;
    tube(.032,sniper?.33:.24,scopeZ,scopeY,'gunmetal');
    tube(sniper?.052:.043,.095,scopeZ-(sniper?.175:.126),scopeY,'carbon');
    tube(.042,.065,scopeZ+(sniper?.172:.13),scopeY,'rubber');
    tube(sniper?.043:.035,.003,scopeZ-(sniper?.224:.175),scopeY,'optic');
    tube(.032,.003,scopeZ+(sniper?.206:.164),scopeY,'optic');
    for(const z of [scopeZ-.07,scopeZ+.07]){
      b(.083,.025,.045,0,.102,z,'titanium');b(.031,.05,.031,0,.126,z,'gunmetal');
      tube(.038,.023,z,scopeY,'titanium');
    }
    kit.cylinder(root,.024,.024,.034,0,.213,scopeZ,'carbon',16);
    const dial=kit.cylinder(root,.022,.022,.034,.046,scopeY,scopeZ,'carbon',16);dial.rotation.z=Math.PI/2;
    if(sniper){
      // Bolt rotates and travels during the shot recovery animation.
      const bolt=new T.Group();root.add(bolt);root.userData.bolt=bolt;
      const stem=kit.cylinder(bolt,.009,.009,.074,.096,.017,.075,'titanium',12);stem.rotation.z=Math.PI/2;
      kit.sphere(bolt,.135,.017,.075,.021,.021,.021,'carbon');
      tube(.023,.12,.075,.016,'titanium',0,bolt);
    }
  }else{
    b(.078,.022,.085,0,.105,-.015,'titanium');
    b(.083,.012,.04,0,.187,-.02,'gunmetal');b(.083,.012,.04,0,.121,-.02,'gunmetal');
    for(const side of [-1,1])b(.012,.064,.04,side*.038,.154,-.02,'gunmetal');
    b(.064,.052,.004,0,.154,-.042,'optic',.002);
    const dot=kit.sphere(root,0,.154,-.046,.0025,.0025,.001,kit.reticleMaterial);dot.castShadow=false;
  }
  // Ejection port and charging lever finish the receiver silhouette.
  b(.008,.031,.081,width/2+.002,.017,.025,'rubber',.003);
  b(.012,.018,.055,width/2+.007,.017,.026,'titanium',.003);
  if(!sniper){b(.04,.014,.025,-width/2-.014,.025,.055,'titanium');b(.024,.023,.03,-width/2-.034,.025,.055,'carbon');}
  const muzzle=smg?-.552:front-(sniper?.106:.081);
  root.userData.muzzle=new T.Vector3(0,.016,muzzle);
  root.userData.design={smg:'VX-9 SWIFT',dmr:'MR-18 FALCON',lmg:'LM-60 IRONCURTAIN',sniper:'SR-7 RAVEN'}[type];
}
