// Shared world-space wetness: the base PBR surface and reflection overlay must
// agree on the shoreline, otherwise water appears to float above dry concrete.
export const dampMaskGLSL=`
float dampHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float dampNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(dampHash(i),dampHash(i+vec2(1.,0.)),f.x),mix(dampHash(i+vec2(0.,1.)),dampHash(i+vec2(1.,1.)),f.x),f.y);}
float facilityDamp(vec2 p){
  float lanes=max(1.-smoothstep(1.6,3.3,abs(abs(p.y)-14.)),(1.-smoothstep(.6,1.7,abs(abs(p.y)-5.)))*.7);
  float shape=dampNoise(p*.92)*.68+dampNoise(p*2.7)*.32;
  return smoothstep(.49,.72,shape)*lanes;
}
`;
