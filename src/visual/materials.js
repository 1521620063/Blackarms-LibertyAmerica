import * as T from 'three';
import { rng } from '../shared/data.js';

// Procedural placeholders are replaced with the locally generated material pack at boot.
export function surface(kind,seed,size=512) {
  const random=rng(seed),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size);
  const palettes={concrete:[151,153,143],floor:[104,113,112],metal:[111,121,122],cloth:[127,137,112]};
  const base=palettes[kind];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,noise=(random()-.5)*(kind==='concrete'?30:16);
    const grain=kind==='cloth'?((x%4<2?7:-7)+(y%4<2?6:-6)):Math.sin(x*.049)*Math.cos(y*.033)*5;
    for(let c=0;c<3;c++)image.data[i+c]=base[c]+noise+grain;
    image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  if(kind==='concrete'){
    for(let i=0;i<1800;i++){
      const x=random()*size,y=random()*size,r=random()*9+.4;
      ctx.fillStyle=`rgba(${random()>.4?'38,40,35':'214,211,193'},${random()*.09})`;
      ctx.beginPath();ctx.ellipse(x,y,r,r*.5,0,0,Math.PI*2);ctx.fill();
    }
    ctx.strokeStyle='rgba(32,38,35,.32)';ctx.lineWidth=2;ctx.strokeRect(1,1,size-2,size-2);
    for(const x of [24,size-24])for(const y of [24,size-24]){ctx.fillStyle='#606960';ctx.beginPath();ctx.arc(x,y,3,0,7);ctx.fill();}
    for(let i=0;i<10;i++){
      let x=random()*size,y=random()*size;ctx.strokeStyle='rgba(45,49,43,.21)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x,y);
      for(let j=0;j<8;j++){x+=(random()-.5)*23;y+=random()*14;ctx.lineTo(x,y);}ctx.stroke();
    }
  }else if(kind==='floor'){
    ctx.strokeStyle='rgba(28,38,38,.65)';ctx.lineWidth=3;ctx.strokeRect(1,1,size-2,size-2);
    for(let y=12;y<size;y+=22)for(let x=9;x<size;x+=32){ctx.strokeStyle='rgba(210,220,211,.17)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+8,y-6);ctx.stroke();}
    for(let i=0;i<140;i++){ctx.strokeStyle=`rgba(26,38,37,${random()*.14})`;ctx.lineWidth=random()*3;const x=random()*size,y=random()*size;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*70,y+random()*18);ctx.stroke();}
  }else if(kind==='metal'){
    for(let i=0;i<650;i++){const x=random()*size,y=random()*size;ctx.strokeStyle=`rgba(222,225,214,${random()*.17})`;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*24,y+random()*2);ctx.stroke();}
  }else{
    for(let i=0;i<120;i++){ctx.fillStyle=`rgba(${i%2?'44,52,37':'170,164,127'},.17)`;ctx.beginPath();ctx.ellipse(random()*size,random()*size,random()*24+8,random()*10+5,random()*6,0,7);ctx.fill();}
  }
  const data=ctx.getImageData(0,0,size,size),height=new Float32Array(size*size);
  for(let i=0;i<height.length;i++)height[i]=(data.data[i*4]+data.data[i*4+1]+data.data[i*4+2])/765;
  const normal=document.createElement('canvas'),rough=document.createElement('canvas');normal.width=rough.width=size;normal.height=rough.height=size;
  const nc=normal.getContext('2d'),rc=rough.getContext('2d'),ni=nc.createImageData(size,size),ri=rc.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
    ni.data.set([128-dx*170,128+dy*170,255,255],i);
    const r=kind==='cloth'?235:kind==='concrete'?210:kind==='floor'?145:125;
    const value=r+(height[y*size+x]-.5)*70;ri.data.set([value,value,value,255],i);
  }
  nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
  const texture=(c,color=false)=>{const t=new T.CanvasTexture(c);if(color)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;};
  return {map:texture(canvas,true),normalMap:texture(normal),roughnessMap:texture(rough)};
}

export function makeMaterials(){
  const concrete=surface('concrete',81),floor=surface('floor',37),metal=surface('metal',72),cloth=surface('cloth',9);
  for(const t of Object.values(floor))t.repeat.set(16,10);
  const m=(color,roughness=.75,metalness=.1,maps={})=>new T.MeshStandardMaterial({color,roughness,metalness,...maps});
  const painted=(color)=>m(color,.72,.35,{...metal,normalScale:new T.Vector2(.35,.35)});
  return {
    concrete:m(0x9d9d90,.95,0,{...concrete,normalScale:new T.Vector2(.7,.7)}),
    wall:m(0xc1c2b2,.95,0,{...concrete,normalScale:new T.Vector2(.6,.6)}),
    floor:m(0xabb7b4,.65,.35,{...floor,normalScale:new T.Vector2(.6,.6)}),
    steel:painted(0x414c4e),dark:painted(0x20282b),edge:m(0xa5afb0,.36,.85,metal),
    olive:m(0x66705a,.93,0,{...cloth,normalScale:new T.Vector2(.6,.6)}),sand:m(0xa29373,.93,0,{...cloth,normalScale:new T.Vector2(.6,.6)}),
    polymer:m(0x7c826c,.94,.05,{normalScale:new T.Vector2(.18,.18)}),
    panel:m(0x687a7d,.82,.35,{normalScale:new T.Vector2(.15,.15)}),
    paintedWall:m(0x485750,.91,.05),floorPaint:m(0xb5b6a1,.92,.02),
    gunmetal:m(0x242c32,.32,.82,metal),cerakote:m(0x88775b,.62,.32,{...metal,normalScale:new T.Vector2(.15,.15)}),
    titanium:m(0x68747c,.29,.88,metal),carbon:m(0x22272b,.76,.12),
    weaponAccent:m(0xb84b2d,.42,.6),
    rubber:m(0x191d1d,.98,0),armor:painted(0x323e3b),yellow:painted(0xd4a847),
    blue:m(0x389aa8,.45,.5,{emissive:0x257c8d,emissiveIntensity:.35}),orange:m(0xc08043,.5,.4,{emissive:0x8d431e,emissiveIntensity:.25}),
    lamp:m(0xc3e8ef,.3,.1,{emissive:0xabe4f3,emissiveIntensity:4.2}),
    warm:m(0xe4b16b,.4,.3,{emissive:0xffa34b,emissiveIntensity:3}),
    red:m(0x9c3027,.5,.2,{emissive:0xff3520,emissiveIntensity:1.7}),
    glass:new T.MeshPhysicalMaterial({color:0x4b737c,metalness:.55,roughness:.13,clearcoat:1,envMapIntensity:2}),
    optic:new T.MeshPhysicalMaterial({color:0x98bdc3,transparent:true,opacity:.19,metalness:.1,roughness:.08,clearcoat:1,depthWrite:false}),
    skin:m(0x99785c,.83,0),brass:m(0xbe9453,.3,.8),screen:m(0x3b8998,.4,.3,{emissive:0x2a9eaf,emissiveIntensity:1.7})
  };
}

export function labelTexture(title,subtitle='',color='#d2e3df',width=1024,height=256){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
  c.fillStyle='#1b2729';c.fillRect(0,0,width,height);c.fillStyle=color;c.fillRect(0,0,12,height);
  c.font=`600 ${height*.36}px Arial`;c.fillText(title,40,height*.5);c.fillStyle='#9baea9';c.font=`${height*.13}px monospace`;c.fillText(subtitle,42,height*.77);
  c.fillStyle=color;for(let i=0;i<42;i++)c.fillRect(width-180+i*3.2,height*.7,1+(i%3),height*.16);
  const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t;
}
