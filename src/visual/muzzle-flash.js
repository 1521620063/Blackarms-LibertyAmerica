import * as T from 'three';

// Demo-inspired crossed flame sheets: a white core, irregular petals and side jets.
export function createMuzzleFlash(){
  const positions=[],uvs=[],types=[];
  function quad(points,type){for(const index of [0,1,2,0,2,3]){positions.push(...points[index]);uvs.push(...[[0,0],[1,0],[1,1],[0,1]][index]);types.push(type);}}
  quad([[-.13,-.13,-.025],[.13,-.13,-.025],[.13,.13,-.025],[-.13,.13,-.025]],0);
  quad([[-.065,0,0],[.065,0,0],[.065,0,-.34],[-.065,0,-.34]],1);
  quad([[0,-.065,0],[0,.065,0],[0,.065,-.34],[0,-.065,-.34]],1);
  quad([[-.18,-.045,-.015],[.18,-.045,-.015],[.18,.045,-.015],[-.18,.045,-.015]],2);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('kind',new T.Float32BufferAttribute(types,1));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneFactor,blendEquation:T.AddEquation,blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,uniforms:{intensity:{value:0},seed:{value:0}},
    vertexShader:'attribute float kind; varying vec2 vUv; varying float vKind; void main(){vUv=uv;vKind=kind;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vUv; varying float vKind; uniform float intensity,seed;
      void main(){vec2 p=vUv*2.0-1.0;float r=length(p);float f;
        if(vKind<.5){float a=atan(p.y,p.x)+seed;float petals=pow(abs(cos(a*2.5)),7.0)+.4*pow(abs(sin(a*4.0)),12.0);float reach=.3+.65*petals;f=(1.0-smoothstep(reach*.12,reach,r))*(.25+petals)+2.0*exp(-r*r*55.0);}
        else if(vKind<1.5){float y=clamp(vUv.y,0.0,1.0);float x=p.x+.12*sin(y*23.0+seed)*y;float width=.18+.24*sin(y*3.14159);f=exp(-x*x/(width*width))*pow(1.0-y,1.7)*(1.0+.25*sin(y*35.0+seed));}
        else {float x=abs(p.x);f=exp(-p.y*p.y*(18.0+25.0*x))*(1.0-smoothstep(.1,.95,x))*smoothstep(.02,.15,x)*.65;}
        // Empty flame-sheet pixels must not touch the color or alpha buffers.
        float energy=max(f,0.0)*max(intensity,0.0);
        if(energy<.001)discard;
        vec3 color=mix(vec3(1.0,.26,.035),vec3(1.0,.88,.6),clamp(f,0.0,1.0));gl_FragColor=vec4(color*energy,0.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;return mesh;
}
export const muzzleScale=type=>({pistol:.65,smg:.7,rifle:1,dmr:1.15,lmg:1.2,scatter:1.5,sniper:1.6}[type]||1);
