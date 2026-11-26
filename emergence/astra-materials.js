import {loom} from './loom.js';
// Bounded native Owlbear SkSL. Coordinates are in design radii, not screen pixels.
const lib=`uniform float2 size;uniform float unit;uniform float2 axis;uniform float3 phase;uniform float3 dye;uniform float3 opt;uniform float seed;
float sat(float x){return clamp(x,0.,1.);}float sq(float x){return x*x;}
float hash(float2 p){float3 v=fract(p.xyx*float3(.1031,.11369,.13787));v+=dot(v,v.yzx+19.19);return fract((v.x+v.y)*v.z);}
float noise2(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+float2(1,0)),f.x),mix(hash(i+float2(0,1)),hash(i+1.),f.x),f.y);}
float gas(float2 p){float v=.57*noise2(p);p=float2(1.64*p.x+1.13*p.y,-1.13*p.x+1.64*p.y)+7.;return v+.29*noise2(p)+.14*noise2(p*2.15+4.7);}
float ridge(float d,float w){return exp(-abs(d)/max(.0001,w));}
float2 rot(float2 v,float a){float c=cos(a),s=sin(a);return float2(c*v.x-s*v.y,s*v.x+c*v.y);}
float zig(float x,float k){float i=floor(x);return 2.*mix(hash(float2(i,k)),hash(float2(i+1.,k)),fract(x))-1.;}
float hex(float2 q){float2 s=float2(1.73205,1.);float2 a=mod(q,s)-.5*s,b=mod(q+.5*s,s)-.5*s;float2 h=abs(dot(a,a)<dot(b,b)?a:b);return .5-max(dot(h,float2(.866025,.5)),h.y);}
float4 coat(float3 c,float a){a=sat(a);return float4(clamp(c,0.,1.)*a,a);}float4 over(float4 a,float4 b){return a+b*(1.-a.a);}
float glint(float2 v){v=abs(v);return exp(-length(v)*9.)+.62*exp(-v.x*3.8-v.y*63.)+.41*exp(-v.y*5.-v.x*61.);}
const float3 ice=float3(.78,.97,1.);
`;
const bodies={...loom,
 flash:`float g=.17+.82*(1.-pow(1.-p,2.4));float fade=pow(1.-p,1.55);float h=exp(-sq(r/g)*2.1)*fade;
 return over(coat(mix(dye,float3(1.),.73),glint(q/(g+.12))*fade),coat(dye,.70*h));`,
 shock:`float edge=.055+.945*(1.-pow(1.-p,2.7));float d=r-edge;float s=.35+.65*pow(.5+.5*cos(a*3.+seed-t*3.),2.);float w=max(.009,opt.x);
 return over(coat(mix(dye,float3(1.),.7),ridge(d,w*.33)*s*(1.-p)),coat(dye,(ridge(d,w)*.65+ridge(d+.04,.016)*.34)*s*(1.-p)));`,
 // Solve the current fragment lane in angular space rather than add one OBR object per chip.
 flecks:`float2 v=q;v.y+=opt.z*.55*sin(3.14159*p);float an=atan(v.y,v.x+.000001);float n=clamp(opt.x,4.,42.);float j=floor((an+3.141593)*n/6.283185);float h=hash(float2(j,seed));float ang=(j+.14+.70*h)*6.283185/n-3.141593;
 float k=.18+.82*hash(float2(j+8.,seed));float2 f=rot(v,-ang)-float2((.37+.70*k)*(1.-pow(1.-p,2.2)),0.);float2 b=rot(f,p*(3.+k));float w=max(.012,opt.y)*(.58+.72*h);
 float diamond=abs(b.x)*.55+abs(b.y);float mask=1.-smoothstep(.55*w,w,diamond);float hot=ridge(length(float2((f.x+.05)*.4,f.y)),.35*w);
 return over(coat(mix(dye,float3(1.),.20+.58*step(0.,b.y+.33*b.x)),mask),coat(dye,hot*.70));`,
 crack:`float u=sat(r);if(r>1.12 || r>min(1.12,p*4.1+.025))return float4(0);float j=floor((a+3.141593)*9./6.283185);float k=hash(float2(j,seed));float ang=(j+.32+.36*k)*6.283185/9.-3.141593;
 float2 v=rot(q,-ang);float line=v.y-(.065*zig(u*9.,j+seed)+.038*zig(u*21.,j+seed+10.))*smoothstep(0.,.24,u);float root=.18+.30*k;
 float arm=line-(u-root)*(.45+.18*k);float twig=ridge(arm,.009)*smoothstep(root,root+.035,u)*(1.-smoothstep(.61,.91,u));float fade=1.-smoothstep(.70,1.07,u);
 return over(coat(ice,(ridge(line,.007)+twig)*fade),coat(dye,(ridge(line,.035)*.75+.48*twig)*fade));`,
 shield:`if(r>1.24)return float4(0);float z=sqrt(max(0.,1.-r*r));float2 k=q/(.56+.44*z);float tile=hex(k*4.3);float front=.12+1.12*smoothstep(.0,.68,p);float sweep=exp(-sq((r-front)/.24));
 float rim=ridge(r-.97,.021);float facet=(1.-smoothstep(.0,.035,tile))*(1.-smoothstep(.95,1.,r));float gl=exp(-length((q+float2(.32,.43))*float2(.8,2.4))*11.);
 return over(coat(mix(dye,ice,.7),(.27+.72*sweep)*facet+.66*rim+gl),coat(dye,.26*ridge(r-.94,.085)+(.06+.20*sweep)*z));`,
 iris:`float openK=max(.015,phase.z);float2 v=q/openK;float rr=length(v);if(rr>1.45)return float4(0);float ang=atan(v.y,v.x+.000001);float d=rr-(.79+.028*sin(5.*ang+t*1.1));
 float edge=ridge(d,.024);float plasma=gas(rot(v,ang*.28-t*.32)*5.+seed);float grooves=ridge(sin(ang*3.+rr*18.-t*2.5+2.3*plasma),.18);float ticks=pow(.5+.5*cos(ang*27.+t*.55),9.);
 float4 c=coat(float3(.014,.035,.075),(1.-smoothstep(.70,.85,rr))*.93);c=over(coat(dye,(.14+.64*plasma)*ridge(d,.108)+.28*grooves*ridge(d+.095,.13)),c);
 return over(coat(ice,edge*(.43+.57*plasma)+.8*ticks*ridge(rr-.968,.016)),c);`,
 // Crown: independent silver leads bend out from the head, each ends in a glass condenser.
 crown:`if(r<.45||r>1.15)return float4(0);float ang=atan(q.y,q.x+.00001);float j=floor((ang+3.141593)*12./6.283185);float an=(j+.5)*6.283185/12.-3.141593;
 float h=hash(float2(j,seed));float2 v=rot(q,-an);float tip=.81+.15*h+.032*sin(1.9*t+j);float u=sat((v.x-.46)/max(.22,tip-.46));
 float off=(.075*sin(u*5.2+t*1.4+j)+.06*sin(u*8.-t*.9+j))*u+.07*sin(2.9*u+j)*u;
 float w=mix(.043,.016,u);float dist=v.y-off;float gate=smoothstep(.46,.54,v.x)*(1.-smoothstep(tip-.02,tip+.005,v.x));float z=clamp(dist/w,-1.,1.);float lam=sqrt(max(0.,1.-z*z));
 float4 c=coat(mix(float3(.07,.145,.23),float3(.74,.86,.93),sat(.56*lam-.39*z+.21*sin(u*62.-j))),gate*(1.-smoothstep(.72,1.12,abs(dist)/w)));
 float pulse=exp(-sq((u-fract(.55*t+j*.27))/.13));c=over(coat(dye,gate*ridge(dist+w*.64,.007)*(.52+.48*pulse)),c);
 float endOff=.075*sin(5.2+t*1.4+j)+.06*sin(8.-t*.9+j)+.07*sin(2.9+j);float2 gem=(v-float2(tip,endOff))/(.045+.019*h);float g=length(gem);
 c=over(coat(dye,.51*exp(-g*1.08)),c);c=over(coat(mix(dye,ice,sat(.10+.63*ridge(g-.83,.13)+.43*exp(-length(gem+float2(.31,.4))*4.))),1.-smoothstep(.82,1.04,g)),c);
 return over(coat(ice,.80*glint(gem+float2(.22,.28))),c);`,
 knot:`float g=mix(.99,.18,smoothstep(.1,1.,p));float2 v=q/g;float rr=length(v);if(rr>1.3)return float4(0);float4 c=float4(0);
 for(int i=0;i<5;i++){float j=float(i);float2 k=rot(v,j*1.2566+t*(.7+.12*j));float y=k.y+.18*sin(k.x*5.+t*2.+j);float d=length(float2(k.x,y*2.8))-.82;
  float face=.52+.44*cos(j+t+k.x*2.);c=over(coat(dye,.65*ridge(d,.10)*face),c);c=over(coat(mix(dye,ice,.63),ridge(d,.026)*face),c);}
 return over(coat(ice,glint(q/(.19+.21*p))*p),c);`,
 lance:`float x=dot(q,axis)+opt.x*.5,y=dot(q,float2(-axis.y,axis.x));float u=x/max(.001,opt.x);if(u<-.04||u>1.05||abs(y)>1.3)return float4(0);
 float front=smoothstep(0.,.30,p);float gate=smoothstep(-.02,.03,u)*(1.-smoothstep(front-.018,front+.016,u));float arc=sin(3.141593*sat(u));float w=.28*arc*sin(u*13.-t*12.+seed);
 float blade=ridge(y,.033)+.64*ridge(y-w,.024)+.34*ridge(y+.64*w,.029);float core=ridge(y,.17)*(.37+.43*arc);
 float2 v=float2(x,y);float rim=ridge(length(v)-.29,.027);float sparks=glint(v*1.5)+.23*rim;
 return over(coat(ice,gate*blade+sparks),coat(dye,gate*(core+.43*ridge(y-w,.105))+.22*rim));`,
 wave:`float x=dot(q,axis)+.5,y=dot(q,float2(-axis.y,axis.x));float dist=length(float2(x,y));if(x<0.||dist>1.025||abs(y)>.5*x+.003)return float4(0);
 float front=sat((t-.65)/1.1);float d=front-dist;float rim=ridge(d,.009);float wake=smoothstep(-.012,.025,d)*(1.-smoothstep(.06,.29,d));
 float2 tile=float2(x*opt.x,y*opt.x);float wall=hex(tile+.23*float2(d,-d));float s=.4+.6*noise2(floor(tile*1.7)+seed);
 float4 c=coat(dye,wake*(.08+.25*s)+.34*ridge(d,.032));c=over(coat(dye,wake*ridge(wall,.051)*(.49+.45*s)),c);
 return over(coat(ice,rim*.88+ridge(d-.033,.003)*.43+ridge(wall,.02)*wake*.62),c);`,
 lens:`float x=dot(q,axis)+opt.x*.5;float y=dot(q,float2(-axis.y,axis.x));float u=x/max(.001,opt.x);if(u<-.06||u>1.10)return float4(0);
 float w=.09+.98*sat(u);float side=y/w;float front=smoothstep(.10,.39,p);float env=smoothstep(-.04,.047,u)*(1.-smoothstep(front-.04,front+.035,u));
 if(abs(side)>1.24||env<.001)return float4(0);float f=gas(float2(u*4.-t*.81,side*2.1));float edge=1.-smoothstep(.79,1.19,abs(side)+.13*(f-.5));
 float ray=ridge(sin(side*9.+u*2.4+t*.55+1.8*f),.18);float spine=ridge(side,.17);float3 ruby=float3(.99,.17,.08),gold=float3(1.,.69,.24);
 return over(coat(float3(1.,.94,.69),env*edge*(.51*spine+.54*ray)*(.48+.5*f)),coat(mix(ruby,gold,sat(f+.28*spine)),env*edge*(.23+.52*f)));`,
 column:`float h=opt.x*.45-q.y;float height=opt.x;float u=h/max(.01,height);if(u<-.13||u>1.06)return float4(0);
 float front=smoothstep(.0,.22,p);float gate=smoothstep(-.11,.03,u)*(1.-smoothstep(front-.09,front+.03,u));float w=.18+.22*(1.-sat(u))+.11*sin(6.*u-2.1*t);
 float f=gas(float2(q.x*2.8+seed,u*5.+t*.72));float band=ridge(abs(q.x+.12*sin(7.*u-t))-(w+.14*f),.049);float inner=ridge(q.x+(f-.5)*.29,.19+.09*f);
 float dust=pow(.5+.5*cos(28.*q.x+8.*u+4.*f),10.)*exp(-abs(q.x)*2.1);
 return over(coat(ice,gate*(.83*inner+.68*band)),coat(dye,gate*(.45*exp(-sq(q.x/.62))+.3*dust)));`,
 seal:`float n=opt.x;float rotA=a+t*.18;float facet=r*cos(mod(rotA+3.141593/n,6.283185/n)-3.141593/n);float2 cell=rot(q,-.20*t);float slash=ridge(cell.x+.27*cell.y,.022)*smoothstep(.18,.39,r)*(1.-smoothstep(.55,.85,r));
 float teeth=pow(.5+.5*cos(rotA*(n*4.)),9.);float lit=.5+.5*cos(3.*a-t*1.7);float fil=ridge(facet-.78,.013)+ridge(r-.99,.014)*(.42+.58*teeth)+.62*ridge(r-.92,.037)*lit;
 float gl=glint((q-float2(cos(t*.7),sin(t*.7))*.93)*4.);
 return over(coat(mix(dye,ice,.58),fil*.79+gl+slash*.48),coat(dye,.38*ridge(facet-.78,.058)+.14*ridge(r-.87,.15)));`,
 wall:`float x=dot(q,axis)+.5*opt.x,y=dot(q,float2(-axis.y,axis.x));float u=x/max(.001,opt.x);float g=1.-sq(1.-sat(t/1.2));float lo=opt.y*(1.-g),hi=opt.y+(1.-opt.y)*g;
 if(u<lo-.006||u>hi+.006||abs(y)>.46)return float4(0);float edge=1.-smoothstep(.27,.44,abs(y));float h=hex(float2(x*3.3,y*3.8));float sweep=exp(-sq((fract(x*.21-t*.37+.5)-.5)/.12));
 float line=ridge(h,.040)*(.42+.57*sweep);float rim=ridge(abs(y)-.28,.021)*(.64+.35*sweep);float ends=ridge(min(abs(u-lo),abs(u-hi))*opt.x,.065);
 return over(coat(ice,edge*(line+ends*.86)),coat(dye,edge*(.17+.2*sweep+rim+.35*ridge(h,.11))));`,
 bolt:`float x=dot(q,axis)+opt.x*.5,y=dot(q,float2(-axis.y,axis.x));float u=x/max(.001,opt.x);if(u<0.||u>1.)return float4(0);
 float n=clamp(opt.x*3.,5.,32.);float k=floor(t*4.6)+seed;float env=sin(3.141593*u);float bend=opt.y*(zig(u*n,k)*.71+zig(u*n*2.6,k+9.)*.29)*env;
 float dz=y-bend;float cell=floor(min(u,.999)*5.);float root=(cell+.12)/5.;float v=(u-root)*7.;float b=opt.y*(zig(root*n,k)*.71+zig(root*n*2.6,k+9.)*.29)*sin(3.141593*root);
 float arm=y-b-(mod(cell,2.)<1.?1.:-1.)*opt.y*(v+.24*zig(v*4.,k+13.)*sin(3.141593*sat(v)));float side=ridge(arm,.014)*smoothstep(0.,.06,v)*(1.-smoothstep(.56,1.,v));float w=max(.009,opt.z);
 return over(coat(mix(dye,ice,.72),ridge(dz,.48*w)+side*.85),coat(dye,ridge(dz,2.*w)*.77+side*.37));`,
};
const cache=new Map();
export function surface(kind){if(!bodies[kind])throw Error('Unknown Emergence material: '+kind);if(!cache.has(kind))cache.set(kind,lib+'\nfloat4 paint(float2 q,float p,float t){float r=length(q),a=atan(q.y,q.x+.000001);'+bodies[kind]+'}\nhalf4 main(float2 coord){return half4(paint((coord-size*.5)/unit,phase.x,phase.y)*sat(phase.z));}');return cache.get(kind);}
