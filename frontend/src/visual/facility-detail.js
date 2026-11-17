import * as T from 'three';
import { BOXES, MAP, rng } from '../game/data.js';

// All cover retains the server's full, solid collision silhouette. Only shallow
// surface relief and structure above the playable ceiling are added here.
export function buildCover(view,b,index){
  const {kit,facility:root}=view;
  const box=(w,h,d,x,y,z,m,r=0)=>kit.box(root,w,h,d,x,y,z,m,r);
  const cylinder=(r,h,x,y,z,m,segments=12)=>kit.cylinder(root,r,r,h,x,y,z,m,segments);
  const freight=b.name.startsWith('货运箱组');
  const rack=b.name.includes('机柜')||b.name.includes('设备柜')||b.name.includes('高掩体');
  const cooler=b.name==='冷却机组';
  const bench=b.name.includes('操作台')||b.name.includes('维修台');
  const shell=freight?(index%2?'containerGreen':'containerRed'):rack?'rack':cooler?'hvac':bench?'worktop':'caseShell';
  box(b.w,b.h,b.d,b.x,b.h/2,b.z,shell,freight?.015:.035);
  box(b.w+.018,.09,b.d+.018,b.x,.065,b.z,'rubber',.008);
  if(freight){
    // Corrugated corten sides, corner castings, door seams and locking rods.
    for(const side of [-1,1]){
      const z=b.z+side*(b.d/2+.008);
      for(let x=b.minX+.18;x<b.maxX-.12;x+=.18)box(.033,b.h-.19,.026,x,b.h/2,z,shell,.008);
      for(const y of [.09,b.h-.09])box(b.w+.024,.105,b.d+.035,b.x,y,b.z,shell,.012);
      for(const x of [b.minX+.065,b.maxX-.065]){
        box(.105,b.h-.06,.07,x,b.h/2,z,'containerEdge',.01);
        for(const y of [.09,b.h-.09])box(.13,.13,.055,x,y,z,'gunmetal',.015);
      }
      view.sign(`BA ${String(index*719+2401).padStart(6,'0')}`,'MAX GROSS  30 480 KG',1.05,b.x+.3,b.h-.49,z+side*.03,side<0?Math.PI:0,'#e0d8be');
    }
    for(const side of [-1,1]){
      const x=b.x+side*(b.w/2+.014);
      box(.018,b.h-.24,b.d-.23,x,b.h/2,b.z,shell,.01);
      box(.022,b.h-.2,.018,x,b.h/2,b.z,'rubber');
      for(const dz of [-b.d*.26,b.d*.26]){
        const rod=cylinder(.016,b.h-.36,x+side*.025,b.h/2,b.z+dz,'titanium');
        for(const y of [.25,b.h*.5,b.h-.25])box(.06,.055,.078,rod.position.x,y,b.z+dz,'containerEdge',.007);
        box(.045,.035,.2,x+side*.055,.97,b.z+dz+.06,'titanium',.006);
      }
    }
  }else if(rack){
    const bays=Math.max(1,Math.round(b.w/.65)),bay=b.w/bays;
    for(const side of [-1,1])for(let i=0;i<bays;i++){
      const x=b.minX+bay*(i+.5),z=b.z+side*(b.d/2+.013);
      box(bay-.045,b.h-.18,.025,x,b.h/2,z,'carbon',.009);
      for(const dx of [-bay/2+.05,bay/2-.05])box(.025,b.h-.25,.028,x+dx,b.h/2,z+side*.018,'titanium',.003);
      for(let y=.24;y<b.h-.12;y+=.19){
        box(bay-.14,.145,.025,x,y,z+side*.022,'rack',.004);
        for(let vent=0;vent<3;vent++)box(bay*.47,.008,.009,x-bay*.1,y-.03+vent*.027,z+side*.039,'rubber');
        box(.018,.012,.012,x+bay*.29,y+.018,z+side*.04,(i+Math.round(y*10))%5?'status':'warm',.002);
      }
      box(.026,.18,.035,x+bay*.36,1.12,z+side*.04,'titanium',.006);
    }
    box(b.w-.07,.04,b.d-.06,b.x,b.h-.02,b.z,'carbon',.008);
  }else if(cooler){
    for(const side of [-1,1]){
      const z=b.z+side*(b.d/2+.015);
      for(const y of [.68,1.77]){
        const fan=cylinder(.34,.033,b.x,y,z,'rubber',32);fan.rotation.x=Math.PI/2;
        const hub=cylinder(.072,.046,b.x,y,z+side*.025,'titanium',16);hub.rotation.x=Math.PI/2;
        for(let i=0;i<7;i++){
          const blade=box(.5,.045,.02,b.x,y,z+side*.027,'steel',.008);blade.rotation.z=i*Math.PI/7;
        }
        for(let i=-5;i<=5;i++)box(Math.sqrt(1-(i/6)**2)*.63,.009,.015,b.x,y+i*.054,z+side*.054,'hvac');
      }
      for(const dx of [-.84,.84])box(.06,b.h-.12,.04,b.x+dx,b.h/2,z,'titanium',.006);
    }
    for(const x of [b.minX-.012,b.maxX+.012])for(let i=0;i<20;i++)box(.015,.028,b.d-.25,x,.25+i*.103,b.z,'rubber',.003);
  }else if(bench){
    box(b.w+.035,.075,b.d+.035,b.x,b.h-.037,b.z,'worktop',.015);
    for(const side of [-1,1]){
      const z=b.z+side*(b.d/2+.012);
      for(let i=0;i<3;i++){
        const x=b.x+(i-1)*b.w*.31;
        box(b.w*.29,b.h-.2,.026,x,b.h/2,z,'hvac',.006);
        for(let drawer=0;drawer<3;drawer++){
          const y=.28+drawer*.25;
          box(b.w*.28,.012,.015,x,y-.09,z+side*.023,'rubber');
          box(b.w*.11,.026,.03,x,y+.026,z+side*.036,'titanium',.004);
        }
      }
    }
  }else{
    // Reinforced transit cases: inset lids, recessed handles, metal latches.
    box(b.w+.02,.08,b.d+.02,b.x,b.h-.06,b.z,'carbon',.015);
    for(const side of [-1,1]){
      const z=b.z+side*(b.d/2+.014);
      for(const x of [b.x-b.w*.36,b.x+b.w*.36]){
        box(.085,b.h-.06,.04,x,b.h/2,z,'carbon',.01);
        box(.052,.12,.047,x,b.h-.2,z+side*.022,'titanium',.006);
        box(.023,.066,.049,x,b.h-.19,z+side*.03,'rubber',.004);
      }
      box(Math.min(.31,b.w*.3),.14,.02,b.x,b.h*.52,z,'rubber',.025);
      box(Math.min(.23,b.w*.23),.035,.043,b.x,b.h*.54,z+side*.015,'caseShell',.009);
      for(let i=0;i<4;i++)box(b.w*.55,.015,.025,b.x,.22+i*.065,z,'carbon',.003);
    }
  }
}

export function facilityArchitecture(view){
  const {kit,facility:root}=view,random=rng(7861);
  const box=(w,h,d,x,y,z,m,r=0)=>kit.box(root,w,h,d,x,y,z,m,r);
  // Clerestory windows and deep facade reveals, above every firing line.
  for(const z of [-MAP.halfDepth+.06,MAP.halfDepth-.06]){
    box(MAP.width,.22,.28,0,4.02,z,'concrete');
    box(MAP.width,1.28,.16,0,4.74,z,'window');
    box(MAP.width,.14,.38,0,5.4,z,'steel');
    for(let x=-MAP.halfWidth+1;x<=MAP.halfWidth-1;x+=3){
      box(.12,1.3,.32,x,4.73,z,'steel');
      box(2.9,.035,.23,x+1.5,4.65,z,'titanium');
    }
  }
  // Warehouse trusses and a suspended yellow bridge crane give the freight
  // lane a strong, human-scale silhouette instead of a repeated light grid.
  for(const z of [-16,-12]){
    box(MAP.width-4,.27,.18,0,4.4,z,'crane');
    box(MAP.width-4,.06,.42,0,4.25,z,'crane');
    for(let x=-MAP.halfWidth+4;x<=MAP.halfWidth-4;x+=4)box(.07,.7,.1,x,4.77,z,'steel');
  }
  for(const x of [-13,13]){
    box(.4,.35,4.4,x,4.42,-14,'crane',.025);
    box(.65,.23,.65,x,4.12,-14,'gunmetal',.03);
    for(const dx of [-.18,.18])box(.018,.65,.018,x+dx,3.71,-14,'titanium');
    box(.5,.13,.3,x,3.38,-14,'yellow',.02);
  }
  // High wall ducts, brackets and acoustic infill follow the existing walls.
  for(const b of BOXES.filter(b=>b.h>=3.9)){
    const alongX=b.w>b.d,length=alongX?b.w:b.d;
    for(let offset=-length/2+.65;offset<length/2-.3;offset+=1.45){
      for(const side of [-1,1]){
        const x=b.x+(alongX?offset:side*(b.w/2+.012));
        const z=b.z+(alongX?side*(b.d/2+.012):offset);
        // Tie holes and local runoff marks break the concrete's repetition.
        for(const y of [1.48,2.95]){
          const hole=kit.cylinder(root,.014,.014,.009,x,y,z,'carbon',8);hole.rotation[alongX?'x':'z']=Math.PI/2;
        }
      }
    }
    if(length>2&&Math.abs(b.z)<MAP.halfDepth-.5){
      box(alongX?length-.2:.12,.17,alongX?.12:length-.2,b.x+(alongX?0:b.w/2+.08),3.33,b.z+(alongX?b.d/2+.08:0),'conduit',.012);
    }
  }
  // Repair panels and shallow threshold plates stay on the floor surface.
  for(const x of [-36,36])for(const z of [-20,0,20]){
    box(4,.006,2.7,x,.005,z,'stagingFloor');
    for(const side of [-1,1])box(4,.008,.055,x,.01,z+side*1.36,'floorPaint');
  }
  // Painted freight arrows and oversized location stencils are readable in play.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const c=canvas.getContext('2d');c.fillStyle='#d5c9a4';c.font='bold 155px Arial';c.textAlign='center';c.fillText('LOADING',512,184);
  c.font='52px monospace';c.fillText('09 — FREIGHT — 11',512,278);
  c.fillRect(150,375,620,25);c.beginPath();c.moveTo(770,330);c.lineTo(875,387);c.lineTo(770,445);c.fill();
  // Seeded chips in the paint, rather than perfectly clean vector text.
  c.globalCompositeOperation='destination-out';for(let i=0;i<2600;i++)c.fillRect(random()*1024,random()*512,random()*5+1,random()*2+1);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  const paint=new T.MeshBasicMaterial({map,transparent:true,opacity:.56,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(const x of [-22,0,22]){
    const marking=new T.Mesh(new T.PlaneGeometry(3.8,1.9),paint);marking.rotation.x=-Math.PI/2;marking.position.set(x,.022,-15.8);root.add(marking);
  }
  // Roof seams and ventilator trunks give shaded ceiling panels readable scale.
  for(let z=-MAP.halfDepth+1.2;z<=MAP.halfDepth-1.2;z+=1.4){
    box(MAP.width-.5,.022,.032,0,5.495,z,'conduit');
  }
  for(const x of [-11,11]){
    box(.62,.22,MAP.depth-.8,x,5.2,0,'hvac',.02);
    for(let z=-MAP.halfDepth+2;z<=MAP.halfDepth-2;z+=2){
      box(.66,.027,.045,x,5.075,z,'titanium',.005);
      for(const dx of [-.27,.27])box(.018,.33,.025,x+dx,5.35,z,'steel');
    }
  }
  // Shallow service stations on exterior walls stay against solid collision.
  for(const z of [-MAP.halfDepth+.23,MAP.halfDepth-.23])for(const x of [-30,-22,-14,-6,6,14,22,30]){
    const facing=z<0?1:-1,front=z+facing*.045;
    box(.72,.48,.055,x,2.42,z,'hvac',.014);
    box(.62,.37,.012,x,2.42,front,'rack',.009);
    for(let vent=0;vent<5;vent++)box(.48,.013,.014,x,2.31+vent*.053,front+facing*.012,'rubber');
    box(.028,.9,.028,x+.4,2.86,z,'conduit',.006);
    box(.84,.035,.035,x,3.3,z,'conduit',.006);
    for(const dx of [-.31,.31])box(.018,.018,.014,x+dx,2.61,front+facing*.012,'titanium',.004);
    view.sign(`${z<0?'F':'S'} / ${String(Math.abs(x)+10).padStart(2,'0')}`,'FACILITY SERVICES',.64,x,1.7,front,z<0?0:Math.PI,z<0?'#91b7bd':'#c8ad7d');
  }
  // Flat skid marks and wall-edge dirt provide contact without adding obstacles.
  const dirtCanvas=document.createElement('canvas');dirtCanvas.width=512;dirtCanvas.height=128;
  const dc=dirtCanvas.getContext('2d');
  for(let i=0;i<1800;i++){
    dc.fillStyle=`rgba(25,24,19,${random()*.06})`;dc.fillRect(random()*512,random()*128,15+random()*80,1+random()*3);
  }
  const dirt=new T.MeshBasicMaterial({map:new T.CanvasTexture(dirtCanvas),transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  for(let i=0;i<16;i++){
    const mesh=new T.Mesh(new T.PlaneGeometry(1.3+random()*2.5,.15+random()*.25),dirt);
    mesh.rotation.x=-Math.PI/2;mesh.rotation.z=(random()-.5)*.6;mesh.position.set(-25+random()*50,.024,i%2?-15.5:15.5);root.add(mesh);
  }
}
