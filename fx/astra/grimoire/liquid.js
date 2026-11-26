// Acid particles only. The comet, breath, impact, shock waves and aura keep their normal magic plates.
export const dropLib=`
float4 bead(float2 v,float2 vel,float w,float stretch,float fade){
 float2 dir=vel/max(.0001,length(vel));float2 z=float2(dot(v,dir),dot(v,float2(-dir.y,dir.x)))/w;
 z.x/=stretch;z.y/=mix(.55,1.,smoothstep(-1.,.36,z.x));float d=length(z);
 float aa=clamp(.70/(unit*w),.08,.45);float m=1.-smoothstep(1.-aa,1.+aa,d);
 float spec=exp(-6.*length((z-float2(.26,-.36))*float2(.83,1.25)));
 float3 col=mix(ink,dye,.52+.41*smoothstep(-.9,.4,-z.y));col=mix(col,lit,.15+.72*spec);
 return coat(col,m*fade);
}
`;
const impact=`float4 c=float4(0);for(int i=0;i<5;i++){
 float j=float(i),h=hash(float2(seed+1.7,j)),k=hash(float2(j,seed+7.5));
 float u=sat((p-.10*h)/(.78+.12*k));float ang=1.25664*(j+.65*h)+seed*.57;
 float2 d=float2(cos(ang),.73*sin(ang))*(.73+.39*k);float2 v=d*(.22+u*(1.40-.60*u));
 v.y+=.75*u*u-.72*u;float2 vel=d*(1.40-1.20*u)+float2(0.,1.50*u-.72);
 c=atop(bead(q-v,vel,.060+.039*h,1.19+.78*(1.-u),smoothstep(.0,.12,u)*(1.-smoothstep(.68,1.,u))),c);
 }return c;`;
export const dropLayers={
 spearAcid:impact,acidSpray:impact,
 comet:`float2 v=float2(-dot(q,axis),dot(q,float2(-axis.y,axis.x)));float4 c=float4(0);
 for(int i=0;i<3;i++){float j=float(i),u=fract(t*1.72+.34*j+.17*seed);float side=mod(j,2.)*2.-1.;
 float2 d=float2((.16+.76*u)*knobs.x,side*(.49+.84*sin(2.6*u))+.20*u*u);
 c=atop(bead(v-d,float2(1.,side*.20),.21+.095*sin(1.25*j+.3),1.52,sin(3.14159*u)*.90),c);
 }return c;`,
 cone:`float2 v=float2(dot(q,axis)+.5,dot(q,float2(-axis.y,axis.x)));float front=.04+.96*(1.-pow(1.-sat(p/.40),3.));float4 c=float4(0);
 for(int i=0;i<6;i++){float j=float(i),h=hash(float2(j+2.,seed)),u=fract(t*(.91+.24*h)+.165*j+.11*seed);
 float x=.19+.71*u;float slope=(mod(j,2.)*2.-1.)*(.53+.51*h)*knobs.x;float2 d=float2(x,x*slope+.042*u*u);
 float fade=sin(3.14159*u)*(1.-smoothstep(front-.06,front+.025,length(d)));
 c=atop(bead(v-d,float2(1.,slope+.10*u),.012+.012*h,1.66+.34*h,fade*.95),c);
 }return c;`,
 drift:`float4 c=float4(0);for(int i=0;i<4;i++){float j=float(i),h=hash(float2(j+3.,seed));float u=sat((p-.16*h-.045*j)/.68);
 float2 d=float2((h-.5)*1.55+.15*sin(j+u*4.),knobs.y*(.47-.93*u+.23*u*u));
 c=atop(bead(q-d,float2(.35*cos(j+u*4.),-1.),.072+.053*h,1.33+.38*(1.-u),sin(3.14159*u)),c);
 }return c;`,
 wisps:`float4 c=float4(0);for(int i=0;i<2;i++){float j=float(i),u=fract(t*.61+.48*j+.07*seed);float ang=seed*.36+3.14*j+t*.46;
 float2 d=float2(cos(ang),sin(ang))*(.81+.17*u);d.y+=.24*u*u;
 c=atop(bead(q-d,float2(-.54*sin(ang),.52*cos(ang)+u),.070+.017*j,1.38,sin(3.14159*u)*.88),c);
 }return c;`,
};
