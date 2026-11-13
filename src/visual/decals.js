import * as T from 'three';
import { rng } from '../shared/data.js';

// One transparent atlas keeps readable real text separate from generated imagery.
export function facilityDecals(group){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const c=canvas.getContext('2d'),random=rng(9301);c.fillStyle='#c6c6ae';c.textAlign='center';
  c.font='800 235px Arial';c.fillText('03',256,300);c.font='600 32px monospace';c.fillText('OPERATIONS',256,368);
  c.lineWidth=8;c.strokeStyle='#c6c6ae';c.strokeRect(55,65,402,363);
  c.save();c.translate(512,0);c.fillStyle='#d4a446';
  c.beginPath();c.moveTo(256,50);c.lineTo(470,418);c.lineTo(42,418);c.closePath();c.fill();
  c.fillStyle='#26302d';c.beginPath();c.moveTo(272,132);c.lineTo(200,268);c.lineTo(252,268);c.lineTo(233,355);c.lineTo(323,223);c.lineTo(269,223);c.closePath();c.fill();c.restore();
  c.save();c.translate(0,512);c.fillStyle='#bfc4b5';
  for(let i=0;i<3;i++){const x=75+i*130;c.beginPath();c.moveTo(x,130);c.lineTo(x+110,245);c.lineTo(x,360);c.lineTo(x+45,360);c.lineTo(x+155,245);c.lineTo(x+45,130);c.closePath();c.fill();}c.restore();
  c.save();c.translate(512,512);c.fillStyle='#243331';c.fillRect(40,70,432,340);c.fillStyle='#cead63';
  c.font='700 100px Arial';c.fillText('CAUTION',256,195);c.font='600 35px monospace';c.fillStyle='#bdc3b2';c.fillText('HIGH VOLTAGE',256,268);c.fillText('AUTHORIZED ACCESS',256,330);c.restore();
  c.globalCompositeOperation='destination-out';
  for(let i=0;i<1900;i++){c.globalAlpha=random()*.4;c.fillRect(random()*1024,random()*1024,random()*8+1,random()*2+1);}c.globalAlpha=1;
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  const material=new T.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,roughness:.94,metalness:0,polygonOffset:true,polygonOffsetFactor:-2});
  const decal=(tile,w,h,x,y,z,rotationY=0,floor=false)=>{
    const geometry=new T.PlaneGeometry(w,h),uv=geometry.attributes.uv;
    const col=tile%2,row=Math.floor(tile/2),padding=.001;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)*(.5-padding*2)+col*.5+padding),uv.getY(i)*(.5-padding*2)+(1-row)*.5+padding);
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);
    if(floor){mesh.rotation.x=-Math.PI/2;mesh.rotation.z=rotationY;}else mesh.rotation.y=rotationY;
    group.add(mesh);
  };
  for(const z of [-6,0,6]){decal(0,1.2,1.2,-12.4,.002,z,-Math.PI/2,true);decal(2,.8,.8,-6,.002,z,0,true);}
  for(const x of [-10.5,-3.5,3.5,10.5])decal(3,.55,.44,x,2.5,-9.76);
  decal(1,.4,.4,-15.77,1.8,6.8,Math.PI/2);decal(1,.4,.4,15.77,1.8,-6.8,-Math.PI/2);
  return material;
}
