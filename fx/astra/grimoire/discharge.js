// Electric plates only. The other elements (including sound and Rolen's blue storm
// magic) keep their own materials. Distances below use the plate's design units.
export const dischargeLib = cyan => `
const float3 corona=${cyan?'float3(.045,.49,.99)':'float3(.115,.30,1.)'};
const float3 strokeHot=${cyan?'float3(.22,.85,1.)':'float3(1.,.72,.10)'};
const float3 hotTip=${cyan?'float3(.80,.99,1.)':'float3(1.,.96,.63)'};
// Nodes hold their positions between strikes. Linear interpolation gives hard elbows;
// the short fine-scale displacement breaks up long facets without making a sine wave.
float node(float i,float k){return 2.*hash(float2(i+13.,k+seed)) - 1.;}
float zig(float u,float n,float k){float v=u*n;return mix(node(floor(v),k),node(floor(v)+1.,k),fract(v));}
float kink(float u,float n,float k){return (.74*zig(u,n,k)+.26*zig(u,n*2.7,k+17.))*min(1.,min(u,1.-u)*8.);}
float strikeKey(float t,float hz){return floor(t*hz+.14*fract(seed))*13.;}
// Premultiplied blue corona, yellow return stroke, almost white only in the hottest filament.
float4 arcLight(float d,float width,float heat,float power){
 float z=abs(d)/max(.0001,width); if(z>10.)return float4(0);
 float4 c=coat(corona,power*.65*exp(-z*.46));
 c=atop(coat(mix(float3(.22,.62,1.),strokeHot,heat),power*(1.-smoothstep(.45,1.38,z))),c);
 return atop(coat(mix(float3(.64,.89,1.),hotTip,heat),power*.92*(1.-smoothstep(.04,.46,z))),c);
}
float trunk(float u,float n,float k,float amp){return amp*kink(sat(u),n,k);}
// One fork per longitudinal cell. Each root is sampled from its actual parent path.
float4 forked(float x,float y,float span,float amp,float n,float k,float width,float heat,float power){
 if(span<.001 || x<0. || x>span)return float4(0);
 float u=x/span;float stem=trunk(u,n,k,amp);
 float cells=clamp(floor(n*.40),2.,8.);float cell=floor(min(u,.99999)*cells);
 float h=hash(float2(cell+7.,k+seed+2.));float root=(cell+.04+.16*h)/cells;
 float life=(u-root)*cells/(.50+.27*h);float4 b=float4(0);
 if(life>0. && life<1.){
   float s=h>.5?1.:-1.;float atRoot=trunk(root,n,k,amp);
   float reach=amp*(.72+.73*hash(float2(cell+4.,k+seed)));
   float twig=atRoot+s*reach*life+.44*reach*kink(life,4.,k+cell+9.);
   b=arcLight(y-twig,width*mix(.70,.27,life),1.-heat,power*(1.-smoothstep(.73,1.,life)));
   if(life>.42 && life<.85){float v=(life-.42)/.43;
    float joint=atRoot+s*reach*.42+.44*reach*kink(.42,4.,k+cell+9.);
    float tip=joint-s*reach*.39*v+.16*reach*kink(v,3.,k+cell+27.);
    b=atop(arcLight(y-tip,width*.33,heat,power*.74*(1.-v*v)),b);}
 }
 return atop(arcLight(y-stem,width,heat,power),b);
}
`;
export const discharge = {
 bolt:`float span=knobs.x;float x=dot(q,axis)+span*.5;float y=dot(q,float2(-axis.y,axis.x));
 float u=x/max(.001,span);float gate=1.-smoothstep(sat(p/max(.01,knobs.z))-.014,sat(p/max(.01,knobs.z))+.01,u);
 if(gate<.001 || abs(y)>knobs.y*2.6+4.)return float4(0);
 float n=clamp(floor(span/(max(knobs.y,.5)*1.7)),6.,34.);float k=strikeKey(t,3.8)+floor(knobs.y*2.7);
 float stem=trunk(u,n,k,knobs.y);float dist=y-stem;float side=max(.7,knobs.y*.78);
 float longitudinal=smoothstep(.00,.08,u)*(1.-smoothstep(.91,1.,u));
 float front=exp(-sq((u-fract(t*1.28))/.115));float wake=exp(-abs(dist)/side);
 float vapor=cloud(float2(u*14.-t*1.8,dist/side*1.3)+seed);float4 air=coat(mix(corona,float3(.49,.64,1.),vapor),wake*(.09+.34*vapor+.19*front)*longitudinal);
 float glints=salt(float2(u*span/2.6-t*5.,y/2.3),.145)*exp(-abs(dist)/(1.+knobs.y));
 air=atop(coat(hotTip,glints*.84*longitudinal),air);
 return gate*atop(forked(x,y,span,knobs.y,n,k,.53,step(.7,dye.x),.94),air);`,
 cone:`float x=dot(q,axis)+.5,y=dot(q,float2(-axis.y,axis.x));float rho=length(float2(x,y));float w=knobs.x;
 float front=.985*smoothstep(0.,.27,p)+.015;float gate=1.-smoothstep(front-.022,front+.01,rho);
 if(x<0. || x>1. || abs(y)>w*x+.014 || gate<.001)return float4(0);
 float k=strikeKey(t,3.2),n=clamp(knobs.y,2.,6.);float amp=.044;float mid=trunk(x,10.,k,amp);float4 c=float4(0);
 for(int i=0;i<6;i++){float j=float(i);if(j<n){
   float h=hash(float2(j+seed,32.));float root=.028+.055*j+.07*h;float end=.81+.16*hash(float2(j,seed+4.));
   float v=(x-root)/(end-root);if(v>0. && v<1.){
    float side=mod(j,2.)<.5?-1.:1.;float tilt=side*w*(.96-.12*j+.045*h);
    float offset=trunk(root,10.,k,amp)+tilt*(x-root);
    float width=(.005+.0032*h)*(1.-.50*v);float age=t-.075-.145*j;float beat=smoothstep(0.,.10,age)*(1.-smoothstep(.28,.65,age));
    float power=(.34+.59*beat+.06*h)*smoothstep(-.16,.03,age)*(1.-smoothstep(.89,1.,v));
    c=atop(forked(x-root,y-offset,end-root,.040+.028*h,7.+j,k+21.+j*4.,width,mod(j,3.)<.5?1.:0.,power),c);
   }
 }}
 float4 mainArc=arcLight(y-mid,.009*(1.-.4*x),1.,.98*(1.-smoothstep(.94,1.,x)));
 // v1.9's two layers of breath and moving particles, but no solid wedge or ring.
 float fan=sat(1.-abs(y)/max(.018,w*x));float vapo=cloud(float2(x*7.-t*1.8,y*11.)+seed);
 float sheet=smoothstep(.0,.49,fan)*smoothstep(.0,.11,x)*(1.-smoothstep(.78,1.,rho));
 float4 air=coat(mix(float3(.12,.35,.90),float3(.44,.70,1.),vapo),sheet*(.08+.37*vapo));
 float swept=salt(float2(x*26.-t*8.,y*33.+seed),.17)*sheet;
 air=atop(coat(mix(corona,hotTip,fan),swept*.84),air);
 return gate*atop(mainArc,atop(c,air));`,
 // A local contact throws short, crooked leaders into the ground, not concentric rings.
 shock:`float g=.08+.92*smoothstep(0.,.30,p);float2 pos=q/g;float d=length(pos);
 if(d>1.08)return float4(0);float k=strikeKey(t,2.6);float cells=7.;float b=(atan(pos.y,pos.x+.00001)+3.141593)*cells/6.283185;
 float j=floor(b);float h=hash(float2(j+seed,k));float angle=(j+.24+.5*h)*6.283185/cells-3.141593;
 float2 v=turn(pos,-angle);float span=.56+.46*h;return forked(v.x,v.y,span,.095,5.,k+j,.022,step(.57,h),(1.-smoothstep(.53,1.,p))*(1.-smoothstep(.72,1.,v.x/span)));`,
 burst:`float span=.19+.80*smoothstep(0.,.39,p);float ang=atan(q.y,q.x+.00001);float b=(ang+3.141593)*5./6.283185;
 float j=floor(b);float k=strikeKey(t,2.8);float h=hash(float2(j,seed+19.));float2 v=turn(q,-((j+.36+.3*h)*6.283185/5.-3.141593));
 float reach=span*(.54+.39*h);float4 bolt=forked(v.x,v.y,reach,.079,4.,k+j+7.,.031,step(.44,h),.94*(1.-smoothstep(.73,1.,v.x/reach)));
 return atop(coat(hotTip,exp(-r*25.)*(1.-p)),bolt);`,
 comet:`float x=-dot(q,axis);float y=dot(q,float2(-axis.y,axis.x));float span=knobs.x;float u=sat(x/max(span,.001));
 float4 b=forked(x,y,span,1.08,7.,strikeKey(t,4.),.29*(1.-.52*u),step(.7,dye.x),1.-smoothstep(.74,1.,u));
 float air=exp(-abs(y)*1.13)*smoothstep(.0,.7,x)*(1.-smoothstep(.48,1.,u));
 float motes=salt(float2(x*1.6-t*6.,y*2.8+seed),.17);
 return atop(coat(hotTip,exp(-length(q)*3.2)),atop(b,atop(coat(hotTip,air*motes),coat(corona,air*(.16+.33*noiseF(q*.72+seed))))));`,
 // Staggered pieces around the silhouette; the middle stays clear for token artwork.
 wisps:`float v=(a+3.141593)*5./6.283185;float j=floor(v);float f=fract(v);float h=hash(float2(j,seed));
 float k=strikeKey(t+h,1.35)+j*3.;float len=.50+.32*h;float u=(f-.08)/len;
 if(u<0. || u>1. || r<.55 || r>1.20)return float4(0);
 float baseline=.85+.10*h+(.06+.06*h)*(u-.5);
 return forked(u,r-baseline,1.,.13,6.,k,.029,step(.5,h),.92);`,
};
