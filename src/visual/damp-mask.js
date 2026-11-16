// Shared world-space wetness: the base PBR surface and reflection overlay must
// agree on the shoreline, otherwise water appears to float above dry concrete.
export const dampMaskGLSL=`
float dampHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float dampNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(dampHash(i),dampHash(i+vec2(1.,0.)),f.x),mix(dampHash(i+vec2(0.,1.)),dampHash(i+vec2(1.,1.)),f.x),f.y);}
float dampPool(vec2 p,vec2 centre,vec2 radius){return 1.-smoothstep(.45,1.,length((p-centre)/radius));}
float facilityDamp(vec2 p){
  float freight=1.-smoothstep(2.1,4.4,abs(abs(p.y)-14.));
  float annex=1.-smoothstep(1.9,4.3,abs(abs(p.y)-23.));
  float galleries=1.-smoothstep(1.3,3.6,abs(abs(p.x)-35.));
  float inner=(1.-smoothstep(.9,2.6,abs(abs(p.y)-5.)))*.75;
  float pools=max(dampPool(p,vec2(-11.,0.),vec2(5.,3.4)),dampPool(p,vec2(12.,2.),vec2(4.5,3.)));
  pools=max(pools,max(dampPool(p,vec2(-22.,9.),vec2(4.,3.5)),dampPool(p,vec2(22.,-8.),vec2(4.5,3.5))));
  float lanes=max(max(freight,annex),max(galleries,max(inner,pools)));
  vec2 warped=p+vec2(dampNoise(p*.38),dampNoise(p*.38+19.))*.8;
  float shape=dampNoise(warped*.34)*.58+dampNoise(warped*.97)*.29+dampNoise(p*2.7)*.13;
  return smoothstep(.34,.63,shape)*lanes;
}
`;
