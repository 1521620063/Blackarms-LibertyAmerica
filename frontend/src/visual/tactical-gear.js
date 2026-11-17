import * as T from 'three';
import { rng } from '../game/data.js';

// Small, neutral material detail. Albedo has no painted lighting; roughness and
// tangent-space normals carry the finish, so the lighting can do its work.
export function tacticalFinish(kind,seed){
  const size=512,random=rng(seed),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d'),image=c.createImageData(size,size),rough=document.createElement('canvas');rough.width=rough.height=size;
  const rc=rough.getContext('2d'),ri=rc.createImageData(size,size);
  const fabric=kind==='fabric',polymer=kind==='polymer';
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,n=(random()-.5)*(fabric?14:8),weave=fabric?((x%4<2?3:-3)+(y%4<2?3:-3)):polymer?Math.sin(x*1.7)*Math.sin(y*2.3)*3:0;
    const value=222+n+weave;image.data.set([value,value,value,255],i);
    const r=(fabric?235:polymer?205:165)+n*2+weave;ri.data.set([r,r,r,255],i);
  }
  c.putImageData(image,0,0);rc.putImageData(ri,0,0);
  if(!fabric&&!polymer)for(let i=0;i<900;i++){
    const x=random()*size,y=random()*size;
    c.strokeStyle=`rgba(255,255,255,${random()*.16})`;c.lineWidth=.4+random()*.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+2+random()*17,y+(random()-.5)*2);c.stroke();
  }
  const normal=document.createElement('canvas');normal.width=normal.height=size;
  const nc=normal.getContext('2d'),ni=nc.createImageData(size,size),pixels=c.getImageData(0,0,size,size).data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,dx=pixels[(y*size+(x+1)%size)*4]-pixels[(y*size+(x+size-1)%size)*4],dy=pixels[(((y+1)%size)*size+x)*4]-pixels[(((y+size-1)%size)*size+x)*4];
    ni.data.set([128-dx*.7,128+dy*.7,255,255],i);
  }
  nc.putImageData(ni,0,0);
  const texture=(image,color=false)=>{const t=new T.CanvasTexture(image);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=T.SRGBColorSpace;return t;};
  return {map:texture(canvas,true),normalMap:texture(normal),roughnessMap:texture(rough)};
}

// A tapered swept surface gives hands and sleeves real silhouettes. The local
// frame follows the curve; unlike stretched cylinders it remains round at bends.
export function sweptGeometry(points,radii,{segments=28,sides=16,folds=0,elliptic=1}={}){
  const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),frames=path.computeFrenetFrames(segments,false);
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,center=path.getPointAt(t),a=t*(radii.length-1),n=Math.min(radii.length-2,Math.floor(a)),radius=T.MathUtils.lerp(radii[n],radii[n+1],a-n);
    for(let j=0;j<=sides;j++){
      const angle=j/sides*Math.PI*2;
      const fold=folds*Math.sin(t*Math.PI)**2*(Math.sin(t*64+Math.sin(angle*2)*1.6)*.65+Math.sin(t*113+angle*3)*.2);
      const p=center.clone().addScaledVector(frames.normals[i],Math.cos(angle)*(radius+fold)).addScaledVector(frames.binormals[i],Math.sin(angle)*(radius+fold)*elliptic);
      positions.push(p.x,p.y,p.z);uv.push(j/sides,t*2);
      if(i<segments&&j<sides){const k=i*(sides+1)+j;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
    }
  }
  // Close swept fingertips and cuffs so oblique views cannot see through them.
  const startCenter=positions.length/3,endCenter=startCenter+1;
  positions.push(...points[0],...points.at(-1));uv.push(.5,.5,.5,.5);
  for(let j=0;j<sides;j++){indices.push(startCenter,j+1,j);const end=segments*(sides+1);indices.push(endCenter,end+j,end+j+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const normals=g.attributes.normal;
  for(let i=0;i<=segments;i++){
    const first=i*(sides+1),last=first+sides,n=new T.Vector3().fromBufferAttribute(normals,first).add(new T.Vector3().fromBufferAttribute(normals,last)).normalize();normals.setXYZ(first,n.x,n.y,n.z);normals.setXYZ(last,n.x,n.y,n.z);
  }
  return g;
}

export function tacticalGlove(kit,parent,x,y,z,rotation){
  const hand=new T.Group();hand.position.set(x,y,z);hand.rotation.z=rotation;parent.add(hand);
  kit.sphere(hand,0,0,.008,.051,.037,.073,'glove');
  kit.sphere(hand,0,.022,.012,.046,.019,.05,'glovePanel');
  kit.box(hand,.087,.015,.048,0,.038,.01,'glove',.009);
  for(let i=0;i<4;i++){
    const fx=-.036+i*.024;
    const finger=kit.geometry(`tacticalFinger:${i}`,()=>sweptGeometry([[fx,0,-.032],[fx,-.012,-.074],[fx,-.044,-.076],[fx,-.059,-.047]],[.012,.012,.011,.009],{segments:12,sides:10}));
    kit.mesh(finger,'glove',hand);
    kit.sphere(hand,fx,.027,-.034,.011,.009,.014,'glovePanel');
    kit.box(hand,.014,.004,.019,fx,.035,-.029,'gloveSeam',.002);
  }
  kit.mesh(kit.geometry('tacticalThumb',()=>sweptGeometry([[.034,-.005,.025],[.064,-.016,.002],[.062,-.04,-.022],[.04,-.051,-.035]],[.019,.017,.014,.011],{segments:14,sides:12})),'glove',hand);
  kit.box(hand,.086,.021,.034,0,.004,.071,'glovePanel',.009);
  kit.box(hand,.027,.008,.027,-.022,.017,.073,'gloveSeam',.004);
  // Stitching sits on the outside of the back panel, not across the knuckles.
  for(const side of [-1,1])for(let i=0;i<7;i++)kit.box(hand,.002,.002,.004,side*.037,.035,-.01+i*.009,'gloveSeam',0);
  return hand;
}

export function firstPersonArms(kit,root,pistol){
  const sleeve=(points,radii)=>kit.mesh(kit.geometry(`tacticalSleeve:${points[0][0]}`,()=>sweptGeometry(points,radii,{segments:56,sides:28,folds:.006,elliptic:.9})),'sleeve',root);
  sleeve([[.16,-.36,.57],[.12,-.29,.34],[.052,-.20,.17],[.025,-.155,.145]],[.074,.069,.05,.038]);
  tacticalGlove(kit,root,.025,-.155,.09,.03);
  if(!pistol){
    sleeve([[-.37,-.36,.25],[-.27,-.26,.05],[-.12,-.17,-.2],[-.07,-.13,-.235]],[.077,.072,.052,.038]);
    tacticalGlove(kit,root,-.055,-.1,-.29,-.55);
  }
}
