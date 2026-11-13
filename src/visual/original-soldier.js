import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original, authored ring surfaces and skin weights; no imported character data.
const PALETTES=[
  {cloth:0x858875,armor:0x706b56,webbing:0x585545,rubber:0x242721,metal:0x50564d,visor:0x17221e,mark:0x8b886f,skin:0xa68a71,mask:0x494c3e,shell:0x646452,insignia:0xffffff},
  {cloth:0x59646d,armor:0x3d464c,webbing:0x303a40,rubber:0x191e21,metal:0x485056,visor:0x14252b,mark:0x868c8b,skin:0xa68a71,mask:0x343c43,shell:0x3b454b,insignia:0xffffff}
];
function clothTexture(side){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d');c.fillStyle='#e8e9e0';c.fillRect(0,0,512,512);
  let seed=1729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const colors=['#939a80','#d4cdb1','#66715e','#b7b698'];
  // Broad, irregular fabric pattern, without the old toy-like pixel blocks.
  for(let i=0;i<(side?0:100);i++){
    const x=random()*512,y=random()*512,r=8+random()*33;
    const points=Array.from({length:9},(_,j)=>{const a=j/9*Math.PI*2,s=r*(.45+random()*.75);return [Math.cos(a)*s,Math.sin(a)*s*.55];});
    c.fillStyle=colors[i%colors.length];
    for(const dx of [-512,0,512])for(const dy of [-512,0,512]){
      c.beginPath();for(const [j,p] of points.entries())j?c.lineTo(x+dx+p[0],y+dy+p[1]):c.moveTo(x+dx+p[0],y+dy+p[1]);c.closePath();c.fill();
    }
  }
  const pixels=c.getImageData(0,0,512,512);
  for(let i=0;i<pixels.data.length;i+=4){const n=(random()-.5)*9;for(let j=0;j<3;j++)pixels.data[i+j]+=n;}
  c.putImageData(pixels,0,0);
  for(let y=0;y<512;y+=3){c.fillStyle='#ffffff08';c.fillRect(0,y,512,1);}
  const texture=new T.CanvasTexture(canvas);texture.name=`original-uniform-${side}`;texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;texture.userData.source='original-procedural';return texture;
}
export function originalSoldierMaterials(side){
  return Object.entries(PALETTES[side]).map(([role,color])=>{
    const m=new T.MeshStandardMaterial({color,vertexColors:true,roughness:role==='visor'?.2:role==='metal'?.58:role==='shell'?.83:.94,metalness:role==='metal'?.35:role==='visor'?.3:0});
    m.name=`original-${side}-${role}`;m.userData.role=role;
    if(role==='cloth')m.map=clothTexture(side);
    if(role==='insignia'){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');
      c.fillStyle=side?'#20282c':'#505340';c.fillRect(0,0,512,256);
      c.strokeStyle=side?'#6c7575':'#95977b';c.lineWidth=3;c.setLineDash([5,4]);c.strokeRect(10,10,492,236);
      c.fillStyle=side?'#b5bdba':'#c0c2a2';c.textAlign='center';c.font='bold 64px Arial';c.fillText(side?'RESPONSE':'SENTINEL',256,112);
      c.font='bold 34px monospace';c.fillText(side?'UNIT  /  02':'FIELD  /  01',256,181);
      m.map=new T.CanvasTexture(canvas);m.map.colorSpace=T.SRGBColorSpace;m.map.anisotropy=4;
    }
    return m;
  });
}
export async function loadOriginalSoldierSurfaces(sideMaterials){
  const loader=new T.TextureLoader(),maps={};
  await Promise.all(['soldier-fabric','soldier-nylon'].map(async id=>{
    maps[id]=await Promise.all(['albedo','normal','roughness'].map(async channel=>{
      const texture=await loader.loadAsync(`/art/characters/${id}-${channel}.webp`);
      texture.colorSpace=channel==='albedo'?T.SRGBColorSpace:T.NoColorSpace;
      texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;
      texture.name=`${id}/${channel}`;texture.userData.source='generated-character-art';return texture;
    }));
  }));
  for(const palette of sideMaterials)for(const material of palette.values()){
    const role=material.userData.role;if(!['cloth','armor','webbing','mask'].includes(role))continue;
    const [albedo,normal,roughness]=maps[['cloth','mask'].includes(role)?'soldier-fabric':'soldier-nylon'];
    if(role==='cloth'){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
      const c=canvas.getContext('2d');c.fillStyle='#e0e0de';c.fillRect(0,0,1024,1024);
      c.globalAlpha=.35;for(let y=0;y<4;y++)for(let x=0;x<4;x++)c.drawImage(albedo.image,x*256,y*256,256,256);
      c.globalAlpha=1;c.globalCompositeOperation='multiply';c.drawImage(material.map.image,0,0,1024,1024);
      material.map.dispose();material.map=new T.CanvasTexture(canvas);material.map.colorSpace=T.SRGBColorSpace;
      material.map.wrapS=material.map.wrapT=T.RepeatWrapping;material.map.anisotropy=4;material.map.name='uniform-composited-albedo';material.map.userData.source='generated-character-art';
    }else material.map=albedo;
    material.normalMap=normal.clone();material.normalMap.repeat.setScalar(role==='cloth'?4:role==='mask'?5:2);
    material.normalScale.setScalar(role==='cloth'?.22:.18);material.roughnessMap=roughness;material.needsUpdate=true;
  }
  return Object.keys(maps).sort();
}
export function createOriginalSoldier(){
  const scene=new T.Group();scene.name='BLA Original Sentinel';
  scene.userData={design:'BLA SENTINEL',source:'original-procedural',version:3};
  const bones=[],byName={};
  const joint=(name,parent,x,y,z)=>{
    const bone=new T.Bone();bone.name=`bla${name}`;bone.position.set(x,y,z);parent.add(bone);bones.push(bone);byName[name]=bone;return bone;
  };
  const hips=joint('Hips',scene,0,.98,0),spine=joint('Spine',hips,0,.15,0),chest=joint('Spine1',spine,0,.18,0);
  const upperChest=joint('Spine2',chest,0,.15,0),neck=joint('Neck',upperChest,0,.105,0),head=joint('Head',neck,0,.11,0);
  joint('HeadEnd',head,0,.17,0);
  for(const [side,sign] of [['Left',-1],['Right',1]]){
    const shoulder=joint(`${side}Shoulder`,upperChest,sign*.13,.01,0);
    const arm=joint(`${side}Arm`,shoulder,sign*.105,-.01,0),fore=joint(`${side}ForeArm`,arm,sign*.275,0,0);
    const hand=joint(`${side}Hand`,fore,sign*.25,0,0);
    for(let i=0;i<5;i++)joint(`${side}Finger${i}`,hand,sign*(i===0?.025:.075),-.026+i*.013,-.024);
    const leg=joint(`${side}UpLeg`,hips,sign*.108,-.025,0),shin=joint(`${side}Leg`,leg,0,-.43,0);
    const foot=joint(`${side}Foot`,shin,0,-.43,0);joint(`${side}ToeBase`,foot,0,-.025,-.15);
  }
  scene.updateMatrixWorld(true);
  const materials=originalSoldierMaterials(0),parts=materials.map(()=>[]),roles=Object.keys(PALETTES[0]);
  const indexOf=name=>bones.indexOf(byName[name]);
  function add(geometry,role,bone,x=0,y=0,z=0,rx=0,ry=0,rz=0){
    if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
    geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));
    if(!geometry.attributes.skinIndex){
      const count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
      for(let i=0;i<count;i++){
        indices[i*4]=indexOf(bone);weights[i*4]=1;
        if(bone==='LeftLeg'||bone==='RightLeg'){
          indices[i*4+1]=indexOf(bone.replace('Leg','UpLeg'));weights[i*4]=.55;weights[i*4+1]=.45;
        }
      }
      geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    }
    if(!geometry.attributes.color){
      const count=geometry.attributes.position.count,colors=new Float32Array(count*3);colors.fill(1);
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    }
    parts[roles.indexOf(role)].push(geometry);
  }
  const box=(role,bone,w,h,d,x,y,z,r=.006,rx=0,ry=0,rz=0)=>add(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)),role,bone,x,y,z,rx,ry,rz);
  const sphere=(role,bone,w,h,d,x,y,z)=>{const g=new T.SphereGeometry(1,16,12);g.scale(w/2,h/2,d/2);add(g,role,bone,x,y,z);};
  // Flattened ribbon with rounded edges, useful for stitched fabric paths.
  function cable(role,bone,points,r=.002){
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*4),r,5,false),role,bone);
  }
  function patch(bone,w,h,x,y,z,rx=0,ry=Math.PI,rz=0){
    add(new T.PlaneGeometry(w,h),'insignia',bone,x,y,z,rx,ry,rz);
  }
  const smooth=(a,b,t)=>T.MathUtils.smoothstep(t,a,b);
  // Smoothly weighted, contiguous ring lofts replace the separate capsule limbs.
  // Rows: centre x/y/z, two radii in the plane normal to the main axis.
  function surface(role,rows,axis,weights,{wrinkles=0,seed=0,segments=24,shape=null}={}){
    const vertices=[],uv=[],indices=[],skin=[],influence=[],colors=[];
    const dense=[];
    const subdivisions=wrinkles?6:3;
    for(let i=0;i<rows.length-1;i++)for(let j=0;j<subdivisions;j++){
      const t=j/subdivisions,a=rows[i],b=rows[i+1],prev=rows[Math.max(0,i-1)],next=rows[Math.min(rows.length-1,i+2)];
      dense.push(a.map((value,k)=>{
        const v0=(b[k]-prev[k])*.5,v1=(next[k]-value)*.5;
        return (2*value-2*b[k]+v0+v1)*t*t*t+(-3*value+3*b[k]-2*v0-v1)*t*t+v0*t+value;
      }));
    }
    dense.push(rows.at(-1));
    for(let row=0;row<dense.length;row++){
      const [cx,cy,cz,r1,r2]=dense[row],v=row/(dense.length-1);
      for(let j=0;j<=segments;j++){
        const a=j/segments*Math.PI*2;
        const envelope=Math.sin(v*Math.PI)**2;
        // Broad compression folds concentrate at bent joints; fine ripples stay subtle.
        const jointZone=axis==='x'?Math.exp(-(((v-.55)/.2)**2)):Math.exp(-(((v-.6)/.19)**2));
        const crease=Math.sin(v*46+Math.sin(a*2)*1.6+seed);
        const ripple=wrinkles*envelope*((.3+.7*jointZone)*crease+.15*Math.sin(v*113+a*3+seed));
        const u=Math.cos(a)*(r1+ripple),w=Math.sin(a)*(r2+ripple*.75);
        const p=axis==='x'?[cx,cy+u,cz+w]:[cx+u,cy,cz+w];if(shape)shape(p,a,v);vertices.push(...p);
        const length=axis==='x'?Math.abs(dense.at(-1)[0]-dense[0][0]):Math.abs(dense.at(-1)[1]-dense[0][1]);
        const repeat=role==='cloth'?1.35:role==='mask'?1.6:1;
        uv.push(j/segments*repeat,v*(role==='cloth'?length/.45:1));
        const seam=Math.exp(-((Math.sin(a)/.045)**2)),creaseShade=wrinkles?Math.min(0,crease)*.055:0;
        const shade=role==='cloth'?.94-seam*.13+creaseShade:1;colors.push(shade,shade,shade);
        const links=weights(p,v),pairs=links.slice(0,4);while(pairs.length<4)pairs.push([links[0][0],0]);
        skin.push(...pairs.map(pair=>indexOf(pair[0])));influence.push(...pairs.map(pair=>pair[1]));
      }
    }
    for(let row=0;row<dense.length-1;row++)for(let j=0;j<segments;j++){
      const a=row*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
    }
    // Winding follows the direction of the loft (left sleeve and vertical surfaces differ).
    const reverse=axis==='y'?rows.at(-1)[1]>rows[0][1]:rows.at(-1)[0]<rows[0][0];
    if(reverse)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(skin,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(influence,4));g.computeVertexNormals();
    // Identical seam normals keep the cloth smooth around the UV seam.
    const normals=g.attributes.normal;
    for(let row=0;row<dense.length;row++){
      const first=row*(segments+1),last=first+segments,n=new T.Vector3().fromBufferAttribute(normals,first).add(new T.Vector3().fromBufferAttribute(normals,last)).normalize();normals.setXYZ(first,n.x,n.y,n.z);normals.setXYZ(last,n.x,n.y,n.z);
    }
    add(g,role,'Hips');
  }
  const rigid=name=>()=>[[name,1]];
  const blend=(a,b,t)=>[[a,1-t],[b,t]];
  const torsoWeight=p=>{
    const y=p[1];
    if(y<1.13)return blend('Hips','Spine',smooth(.99,1.13,y));
    if(y<1.32)return blend('Spine','Spine1',smooth(1.13,1.32,y));
    if(y<1.46)return blend('Spine1','Spine2',smooth(1.32,1.46,y));
    return blend('Spine2','Neck',smooth(1.48,1.58,y));
  };
  // Jacket: shaped waist, latissimus, sloping trapezius and a continuous neck.
  surface('cloth',[
    [0,.89,.012,.14,.105],[0,.96,.012,.171,.115],[0,1.06,.01,.17,.115],
    [0,1.18,.006,.185,.127],[0,1.31,.002,.217,.145],[0,1.4,0,.232,.139],
    [0,1.465,0,.212,.12],[0,1.505,.002,.15,.093],[0,1.54,.006,.08,.074],
    [0,1.59,.008,.063,.064],[0,1.61,.008,.058,.059]
  ],'y',torsoWeight,{wrinkles:.003});
  // Balaclava shaped around jaw, cheeks, brow and skull, with no exposed neck gap.
  surface('mask',[
    [0,1.555,.007,.06,.06],[0,1.593,-.007,.066,.068],[0,1.622,-.009,.073,.081],
    [0,1.658,-.002,.085,.093],[0,1.701,0,.089,.097],[0,1.748,.003,.087,.098],
    [0,1.792,.009,.075,.088],[0,1.825,.011,.052,.065],[0,1.842,.011,.002,.003]
  ],'y',p=>blend('Neck','Head',smooth(1.57,1.63,p[1])),{segments:40,wrinkles:.0007,shape:(p,a)=>{
    const front=Math.max(0,-Math.sin(a));
    p[2]-=.021*Math.exp(-(((p[1]-1.703)/.03)**2))*front**12;
    p[2]+=.006*Math.exp(-(((p[1]-1.646)/.026)**2))*front**4;
  }});
  // Exposed eye area and a human nose bridge under a close fitting eye shield.
  sphere('skin','Head',.113,.026,.018,0,1.734,-.091);
  // Facial planes are part of the mask surface; there is no floating mouth or nose piece.
  for(const sign of [-1,1]){
    box('rubber','Head',.055,.006,.009,sign*.034,1.741,-.105,.002,0,sign*.13,sign*.04);
    sphere('rubber','Head',.017,.008,.009,sign*.033,1.73,-.105);
  }
  // Curved, thin goggles rather than two oversized blocks.
  const lensShape=new T.Shape();lensShape.moveTo(-.081,.002);lensShape.quadraticCurveTo(-.073,.028,-.02,.025);lensShape.lineTo(.02,.025);lensShape.quadraticCurveTo(.073,.028,.081,.002);lensShape.lineTo(.071,-.025);lensShape.lineTo(.029,-.027);lensShape.lineTo(.009,-.012);lensShape.lineTo(-.009,-.012);lensShape.lineTo(-.029,-.027);lensShape.lineTo(-.071,-.025);lensShape.closePath();
  const lens=new T.ShapeGeometry(lensShape,10);const lp=lens.attributes.position;
  for(let i=0;i<lp.count;i++)lp.setZ(i,-.025*(Math.abs(lp.getX(i))/.081)**1.7);
  lens.computeVertexNormals();
  const frame=lens.clone();frame.scale(1.1,1.24,1);add(frame,'rubber','Head',0,1.731,-.116,0,Math.PI,0);
  add(lens,'visor','Head',0,1.731,-.123,0,Math.PI,0);
  box('webbing','Head',.008,.017,.177,-.087,1.734,.008,.003);box('webbing','Head',.008,.017,.177,.087,1.734,.008,.003);
  // Helmet shell follows the skull, with a lower rear cut and a brow overhang.
  const helmetRows=[
    [0,1.762,.011,.105,.121],[0,1.79,.014,.11,.123],[0,1.828,.017,.099,.111],
    [0,1.862,.019,.075,.085],[0,1.883,.02,.037,.043],[0,1.887,.02,.002,.003]
  ];
  const helmetCut=(p,a,v)=>{p[1]+=.039*Math.pow(Math.abs(Math.cos(a)),6)*Math.pow(1-v,3);};
  surface('shell',helmetRows,'y',rigid('Head'),{segments:40,shape:helmetCut});
  surface('rubber',[[0,1.757,.011,.106,.122],[0,1.766,.011,.107,.123]],'y',rigid('Head'),{segments:40,shape:(p,a)=>{p[1]+=.039*Math.pow(Math.abs(Math.cos(a)),6);}});
  for(const sign of [-1,1]){
    box('rubber','Head',.014,.028,.104,sign*.108,1.798,.02,.005);
    for(let rail=0;rail<4;rail++)box('metal','Head',.004,.011,.012,sign*.117,1.796,-.014+rail*.021,.002);
    sphere('rubber','Head',.044,.086,.069,sign*.099,1.704,.021);
    box('shell','Head',.017,.061,.05,sign*.118,1.703,.022,.012);
    cable('rubber','Head',[[sign*.106,1.72,.04],[sign*.105,1.758,.055],[sign*.085,1.787,.065]],.004);
    cable('webbing','Head',[[sign*.098,1.744,-.006],[sign*.073,1.658,-.053],[sign*.047,1.624,-.075],[0,1.619,-.079]],.005);
    box('rubber','Head',.035,.013,.045,sign*.058,1.856,-.039,.003,0,0,sign*.1);
  }
  box('metal','Head',.034,.036,.015,0,1.803,-.112,.004);
  box('rubber','Head',.035,.021,.028,0,1.83,-.11,.004,-.3);
  const mic=new T.CatmullRomCurve3([new T.Vector3(-.114,1.685,-.004),new T.Vector3(-.124,1.656,-.06),new T.Vector3(-.07,1.65,-.108)]);
  add(new T.TubeGeometry(mic,10,.003,5,false),'metal','Head');sphere('rubber','Head',.02,.012,.014,-.067,1.65,-.109);
  // Contoured plate carriers: clipped shoulders, thin layered fabric, no cuboid body shell.
  function plate(role,bone,outline,depth,z){
    const shape=new T.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.004,bevelSize:.005,bevelSegments:3,steps:1,curveSegments:6});
    const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*6,uv.getY(i)*6);
    if(bone==='Spine1'){
      const p=geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const bend=.025*(Math.abs(p.getX(i))/.175)**2+.019*(1-T.MathUtils.clamp((p.getY(i)-1.1)/.33,0,1));
        p.setZ(i,p.getZ(i)+(z<0?bend:-bend));
      }
      geometry.computeVertexNormals();
    }
    add(geometry,role,bone,0,0,z);
  }
  const plateOutline=[[-.143,1.095],[.143,1.095],[.173,1.16],[.173,1.354],[.115,1.435],[-.115,1.435],[-.173,1.354],[-.173,1.16]];
  plate('rubber','Spine1',plateOutline,.018,-.17);
  plate('armor','Spine1',plateOutline,.039,-.201);
  plate('armor','Spine1',plateOutline,.038,.143);
  cable('webbing','Spine1',[[-.142,1.108,-.208],[-.159,1.17,-.208],[-.16,1.345,-.208],[-.108,1.42,-.208],[.108,1.42,-.208],[.16,1.345,-.208],[.159,1.17,-.208],[.142,1.108,-.208]],.0025);
  // Side panels and curved straps follow the rib cage instead of a floating belt.
  surface('webbing',[[0,1.129,.004,.189,.146],[0,1.169,.004,.197,.153],[0,1.223,.004,.198,.157],[0,1.241,.004,.195,.154]],'y',rigid('Spine1'),{segments:40});
  for(const sign of [-1,1]){
    for(const y of [1.156,1.2])cable('armor','Spine1',[[sign*.15,y,-.098],[sign*.19,y,-.04],[sign*.196,y,.03],[sign*.166,y,.104]],.004);
    const strap=new T.CatmullRomCurve3([new T.Vector3(sign*.115,1.348,-.162),new T.Vector3(sign*.143,1.468,-.09),new T.Vector3(sign*.139,1.493,.009),new T.Vector3(sign*.12,1.389,.154)]);
    // Flattened tubing produces a fabric strap over the actual shoulder contour.
    const strapG=new T.TubeGeometry(strap,24,.021,8,false),sp=strapG.attributes.position;
    for(let i=0;i<sp.count;i++){
      const center=strap.getPointAt(Math.floor(i/9)/24);
      sp.setXYZ(i,sp.getX(i),center.y+(sp.getY(i)-center.y)*.19,center.z+(sp.getZ(i)-center.z)*.19);
    }
    strapG.computeVertexNormals();add(strapG,'webbing','Spine2');
    box('metal','Spine1',.034,.016,.012,sign*.125,1.386,-.185,.003);
  }
  // Stitched webbing and compressed fabric magazine pockets.
  for(let row=0;row<4;row++)for(let col=-2;col<=2;col++)box('webbing','Spine1',.046,.009,.008,col*.057,1.182+row*.035,-.21,.002);
  for(let i=-1;i<=1;i++){
    const x=i*.093;
    surface('armor',[[x,1.087,-.226,.036,.024],[x,1.102,-.231,.043,.037],[x,1.223,-.229,.041,.035],[x,1.244,-.226,.039,.031]],'y',rigid('Spine1'),{wrinkles:.002,segments:16});
    box('rubber','Spine1',.058,.042,.028,x,1.245,-.229,.005);
    cable('webbing','Spine1',[[x-.024,1.213,-.269],[x-.02,1.267,-.244],[x+.02,1.267,-.244],[x+.024,1.213,-.269]],.003);
    for(const sign of [-1,1])cable('webbing','Spine1',[[x+sign*.033,1.108,-.26],[x+sign*.035,1.185,-.268],[x+sign*.033,1.231,-.261]],.0012);
    box('webbing','Spine1',.072,.012,.008,x,1.127,-.267,.002);
    box('webbing','Spine1',.072,.012,.008,x,1.164,-.267,.002);
  }
  box('webbing','Spine1',.155,.062,.008,0,1.353,-.209,.004);
  patch('Spine1',.149,.058,0,1.353,-.215);
  patch('Spine1',.17,.07,0,1.345,.188,0,0);
  cable('rubber','Spine1',[[-.194,1.302,-.07],[-.18,1.402,-.12],[-.112,1.436,-.17],[-.087,1.366,-.22]],.003);
  box('rubber','Spine1',.035,.046,.017,-.096,1.371,-.22,.006);
  // Back hydration pack, radio and restrained external detail.
  surface('webbing',[[0,1.115,.184,.073,.019],[0,1.16,.197,.098,.036],[0,1.34,.194,.091,.035],[0,1.388,.175,.066,.018]],'y',rigid('Spine1'),{wrinkles:.002});
  box('webbing','Spine1',.125,.072,.035,0,1.188,.231,.009);
  for(const sign of [-1,1])box('rubber','Spine1',.008,.18,.006,sign*.065,1.283,.23,.002);
  box('rubber','Spine1',.048,.094,.032,-.188,1.29,-.055,.007);
  const antenna=new T.CatmullRomCurve3([new T.Vector3(-.195,1.327,-.05),new T.Vector3(-.2,1.43,-.04),new T.Vector3(-.19,1.51,-.02)]);
  add(new T.TubeGeometry(antenna,6,.003,4,false),'rubber','Spine1');
  surface('webbing',[[0,1.015,.008,.177,.123],[0,1.053,.008,.177,.123]],'y',rigid('Hips'));
  box('metal','Hips',.044,.026,.012,0,1.034,-.121,.003);
  box('webbing','Hips',.07,.092,.043,-.173,1.0,-.028,.008);
  box('webbing','Hips',.085,.096,.05,.133,1.01,.122,.012);
  for(const sign of [-1,1]){
    for(const z of [-.095,.095])box('webbing','Hips',.025,.06,.012,sign*.117,1.032,z,.003);
    box('rubber','Hips',.034,.018,.012,sign*.134,1.037,-.09,.003);
  }
  cable('webbing','Hips',[[.012,1.005,-.119],[.015,.955,-.113],[.01,.91,-.1]],.0018);
  // Sleeves and trousers each have one surface across the elbow / knee, with blended weights.
  for(const [side,sign] of [['Left',-1],['Right',1]]){
    const sleeveWeight=p=>{
      const x=Math.abs(p[0]);
      if(x<.27)return blend('Spine2',`${side}Arm`,smooth(.155,.27,x));
      if(x<.56)return blend(`${side}Arm`,`${side}ForeArm`,smooth(.455,.555,x));
      return blend(`${side}ForeArm`,`${side}Hand`,smooth(.725,.77,x));
    };
    const armRows=[
      [.09,1.433,0,.065,.08],[.15,1.443,0,.078,.087],[.223,1.456,0,.084,.091],[.28,1.456,0,.082,.083],
      [.355,1.456,.002,.075,.075],[.43,1.456,.001,.068,.066],[.49,1.456,0,.066,.061],
      [.535,1.456,0,.064,.063],[.585,1.456,0,.068,.064],[.645,1.456,-.002,.059,.056],
      [.708,1.456,-.002,.047,.047],[.743,1.456,-.003,.041,.042],[.758,1.456,-.003,.04,.041]
    ].map(([x,...rest])=>[sign*x,...rest]);
    surface('cloth',armRows,'x',sleeveWeight,{wrinkles:.007,seed:side==='Left'?2:7});
    // Small fabric sleeve pocket and subdued unit patch, without glowing armbands.
    box('cloth',`${side}Arm`,.111,.013,.102,sign*.33,1.534,.002,.012);
    box('webbing',`${side}Arm`,.079,.004,.058,sign*.33,1.543,.002,.004);
    patch(`${side}Arm`,.073,.048,sign*.33,1.546,.002,-Math.PI/2,0,sign*Math.PI/2);
    cable('webbing',`${side}Arm`,[[sign*.284,1.54,-.039],[sign*.33,1.544,-.043],[sign*.377,1.533,-.037]],.0017);
    box('webbing',`${side}ForeArm`,.029,.083,.083,sign*.738,1.456,-.003,.006);
    // Anatomical glove: tapered palm, thumb and folded fingers around the weapon grip.
    surface('rubber',[[sign*.748,1.456,-.003,.037,.038],[sign*.78,1.451,-.006,.036,.041],[sign*.817,1.445,-.011,.031,.037],[sign*.845,1.433,-.017,.025,.029],[sign*.852,1.424,-.021,.012,.018]],'x',rigid(`${side}Hand`),{segments:16});
    for(let finger=0;finger<4;finger++)sphere('rubber',`${side}Hand`,.042,.015,.032,sign*.828,1.421+finger*.014,-.036);
    sphere('rubber',`${side}Hand`,.04,.032,.06,sign*.784,1.422,-.042);
    for(let knuckle=0;knuckle<3;knuckle++)sphere('webbing',`${side}Hand`,.018,.01,.015,sign*(.79+knuckle*.018),1.486,-.015);
    const legWeight=p=>{
      const y=p[1];
      if(y>.85)return blend('Hips',`${side}UpLeg`,1-smooth(.86,1.01,y));
      if(y>.43)return blend(`${side}Leg`,`${side}UpLeg`,smooth(.44,.6,y));
      return blend(`${side}Foot`,`${side}Leg`,smooth(.11,.23,y));
    };
    const legRows=[
      [sign*.096,1.005,.015,.101,.111],[sign*.103,.95,.009,.11,.119],
      [sign*.111,.87,.004,.111,.119],[sign*.115,.77,-.002,.109,.111],
      [sign*.116,.665,-.002,.095,.095],[sign*.115,.575,-.003,.083,.084],
      [sign*.114,.524,-.005,.077,.079],[sign*.114,.47,0,.082,.081],
      [sign*.112,.39,.015,.085,.086],[sign*.11,.30,.017,.078,.077],
      [sign*.108,.22,.009,.064,.065],[sign*.108,.178,.003,.061,.062]
    ];
    surface('cloth',legRows,'y',legWeight,{wrinkles:.007,seed:side==='Left'?0:4});
    // Shaped inset reinforcement and low-profile articulated kneepad.
    const kx=sign*.114,kneeOutline=[[-.044,-.068],[.044,-.068],[.061,-.038],[.059,.038],[.038,.069],[-.038,.069],[-.059,.038],[-.061,-.038]].map(([x,y])=>[x+kx,y+.531]);
    plate('webbing',`${side}Leg`,kneeOutline,.014,-.096);
    plate('shell',`${side}Leg`,kneeOutline.map(([x,y])=>[kx+(x-kx)*.85,.531+(y-.531)*.83]),.012,-.109);
    for(const y of [.51,.529,.548])box('rubber',`${side}Leg`,.06,.004,.003,kx,y,-.114,.001);
    for(const dx of [-.039,.039])sphere('metal',`${side}Leg`,.005,.005,.003,kx+dx,.533,-.115);
    box('cloth',`${side}UpLeg`,.035,.172,.14,sign*.214,.789,.014,.014);
    box('cloth',`${side}UpLeg`,.041,.043,.147,sign*.217,.854,.014,.009);
    box('webbing',`${side}UpLeg`,.003,.146,.005,sign*.235,.77,-.044,.001);
    for(const z of [-.032,.058])box('mark',`${side}UpLeg`,.004,.006,.009,sign*.238,.84,z,.001);
    if(sign===1){
      box('rubber',`${side}UpLeg`,.044,.15,.074,.247,.784,-.022,.011);
      box('webbing',`${side}UpLeg`,.051,.033,.122,.238,.743,-.009,.005);
      box('metal',`${side}UpLeg`,.035,.081,.035,.251,.859,-.023,.004,0,0,-.12);
      box('rubber',`${side}UpLeg`,.042,.068,.038,.255,.87,.014,.005,-.22);
      box('webbing',`${side}UpLeg`,.047,.021,.03,.258,.844,-.057,.004);
    }
    // Curved boot upper and a rounded toe, rather than separate square blocks.
    surface('rubber',[
      [sign*.108,.028,-.054,.059,.128],[sign*.108,.046,-.054,.061,.131],
      [sign*.108,.079,-.055,.06,.124],[sign*.108,.108,-.035,.057,.101],
      [sign*.108,.151,-.005,.052,.061],[sign*.108,.204,.006,.05,.056],[sign*.108,.22,.008,.049,.054]
    ],'y',rigid(`${side}Foot`),{segments:24});
    surface('webbing',[[sign*.108,.027,-.054,.06,.129],[sign*.108,.044,-.054,.063,.132]],'y',rigid(`${side}Foot`));
    for(let lace=0;lace<5;lace++){
      const y=.101+lace*.017,z=-.13+lace*.017;
      cable('webbing',`${side}Foot`,[[sign*.108-.026,y,z],[sign*.108+.026,y+.007,z+.006]],.0018);
      cable('webbing',`${side}Foot`,[[sign*.108+.026,y,z],[sign*.108-.026,y+.007,z+.006]],.0018);
    }
    for(const dx of [-.052,.052])for(let lug=0;lug<7;lug++)box('rubber',`${side}Foot`,.017,.018,.022,sign*.108+dx,.03,-.142+lug*.032,.003);
    cable('webbing',`${side}Foot`,[[sign*.108-.047,.07,-.13],[sign*.108-.03,.077,-.166],[sign*.108+.03,.077,-.166],[sign*.108+.047,.07,-.13]],.0018);
  }
  // Raise the shoulder girdle and shorten the face consistently in both mesh and bind pose.
  // This keeps the authored volumes, equipment and IK endpoints in the same coordinate space.
  const landmarks=[[0,0],[1.1,1.1],[1.46,1.515],[1.6,1.64],[1.73,1.755],[1.9,1.9]];
  function anatomy(y){
      const raw=landmarks.findIndex((p,j)=>j<landmarks.length-1&&y<=landmarks[j+1][0]);
      const i=raw<0?landmarks.length-2:raw;
    const a=landmarks[i],b=landmarks[i+1],slope=(b[1]-a[1])/(b[0]-a[0]);return [a[1]+(y-a[0])*slope,slope];
  }
  const authored=bones.map(b=>b.getWorldPosition(new T.Vector3()));
  const armLength=(x,y)=>y>1.3&&y<1.6&&Math.abs(x)>.235?Math.sign(x)*(.235+(Math.abs(x)-.235)*1.1):x;
  bones.forEach((bone,i)=>{
    const p=authored[i].clone();p.x=armLength(p.x,p.y);p.y=anatomy(p.y)[0];
    bone.parent.worldToLocal(p);bone.position.copy(p);bone.updateMatrixWorld(true);
  });
  for(const group of parts)for(const geometry of group){
    const p=geometry.attributes.position,n=geometry.attributes.normal;
    for(let i=0;i<p.count;i++){
      const oldY=p.getY(i),[y,slope]=anatomy(oldY);p.setX(i,armLength(p.getX(i),oldY));p.setY(i,y);
      const normal=new T.Vector3(n.getX(i),n.getY(i)/slope,n.getZ(i)).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
    }
  }
  scene.updateMatrixWorld(true);
  // Shared geometry, independent skeletons per actor. Count blended vertices for regression checks.
  let blendedVertices=0,vertices=0;
  const skeleton=new T.Skeleton(bones);
  for(let i=0;i<parts.length;i++)if(parts[i].length){
    const geometry=mergeGeometries(parts[i],false);for(const part of parts[i])part.dispose();
    geometry.computeBoundingSphere();vertices+=geometry.attributes.position.count;
    const w=geometry.attributes.skinWeight;for(let j=0;j<w.count;j++)if(w.getY(j)>.001&&w.getX(j)>.001)blendedVertices++;
    const mesh=new T.SkinnedMesh(geometry,materials[i]);mesh.name=`Sentinel-${roles[i]}`;scene.add(mesh);mesh.bind(skeleton);mesh.frustumCulled=false;
  }
  scene.userData.blendedVertices=blendedVertices;scene.userData.vertices=vertices;
  const quaternion=(x,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z)).toArray();
  function motion(name,duration,stride){
    const tracks=[],times=Array.from({length:17},(_,i)=>i*duration/16);
    for(const [side,phase] of [['Left',0],['Right',Math.PI]]){
      for(const [jointName,curve] of [
        ['UpLeg',t=>stride*Math.sin(t+phase)],
        ['Leg',t=>Math.max(0,-Math.sin(t+phase))*(stride*1.45)],
        ['Foot',t=>stride?-.12*Math.sin(t+phase):0],['Arm',()=>0]
      ]){
        const values=times.flatMap(t=>{
          const idle=!stride,sign=side==='Left'?-1:1;
          const base=idle?(jointName==='UpLeg'?-.1:jointName==='Leg'?.16:jointName==='Foot'?-.06:0):0;
          return quaternion(curve(t/duration*Math.PI*2)+base,0,jointName==='Arm'?-sign*1.12:jointName==='UpLeg'&&idle?sign*.1:0);
        });
        tracks.push(new T.QuaternionKeyframeTrack(`bla${side}${jointName}.quaternion`,times,values));
      }
    }
    tracks.push(new T.VectorKeyframeTrack('blaHips.position',times,times.flatMap(t=>[0,.98+(stride?Math.abs(Math.sin(t/duration*Math.PI*2))*stride*.018:Math.sin(t/duration*Math.PI*2)*.0015),0])));
    tracks.push(new T.QuaternionKeyframeTrack('blaSpine.quaternion',times,times.flatMap(t=>quaternion(stride?-.095:-.07,.012*Math.sin(t/duration*Math.PI*2)))));
    return new T.AnimationClip(name,duration,tracks);
  }
  return {scene,animations:[motion('Idle',3.6,0),motion('Walk',1,.42),motion('Run',.66,.78)]};
}
