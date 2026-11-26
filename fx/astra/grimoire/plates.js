import { discharge, dischargeLib } from './discharge.js';
import { dropLayers, dropLib } from './liquid.js';
import { spearBodies } from './spear.js';
import { thresholdFault, wardBodies } from './threshold-wards.js';
// Bounded, premultiplied SkSL plates. q is measured in design radii, not screen pixels.
// The compiler sees only the selected silhouette and plate, not a giant per-pixel switch.
const lib=`uniform float2 size;uniform float unit;uniform float3 phase;uniform float3 dye;uniform float3 lit;uniform float3 ink;uniform float3 knobs;uniform float2 axis;uniform float seed;
float sat(float x){return clamp(x,0.,1.);} float sq(float x){return x*x;}
float hash(float2 q){float3 v=fract(float3(q.xyx)*float3(.1031,.1227,.1099));v+=dot(v,v.zxy+24.78);return fract((v.x+v.z)*v.y);}
float noiseF(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+float2(1,0)),f.x),mix(hash(i+float2(0,1)),hash(i+1.),f.x),f.y);}
float channel(float u,float t){float x=floor(u),f=fract(u),k=floor(t);float z=fract(t);z=z*z*(3.-2.*z);return mix(mix(hash(float2(x,k)),hash(float2(x+1.,k)),f),mix(hash(float2(x,k+1.)),hash(float2(x+1.,k+1.)),f),z)*2.-1.;}
float cloud(float2 p){float n=.56*noiseF(p);p=float2(1.6*p.x-1.35*p.y,1.35*p.x+1.6*p.y)+8.;n+=.29*noiseF(p);return n+.15*noiseF(p*2.18+4.3);}
float ridge(float d,float w){return exp(-abs(d)/max(.0005,w));}
float2 turn(float2 p,float a){float c=cos(a),s=sin(a);return float2(c*p.x-s*p.y,s*p.x+c*p.y);}
float4 coat(float3 c,float a){a=sat(a);return float4(clamp(c,0.,1.)*a,a);}
float4 atop(float4 a,float4 b){return a+b*(1.-a.a);}
float flare(float2 p){float2 v=abs(p);return exp(-length(p)*10.)+.81*exp(-v.x*4.-v.y*83.)+.61*exp(-v.y*5.-v.x*72.);}
float salt(float2 p,float width){float2 i=floor(p);float2 v=fract(p)-(.2+.6*float2(hash(i+seed),hash(i+seed+12.)));return (1.-smoothstep(.0,width,length(v*float2(1.25,.73))))*smoothstep(.26,.8,hash(i+7.));}
float engraving(float a,float n){return abs(fract(a*n/6.283185+.5)-.5)*2.;}
`;
// Distinct spatial signatures, also used inside moving breath and projectile materials.
const texture={
 fire:'float f=cloud(q*3.+float2(seed,t*.78));return cloud(q*6.+float2(f*3.1,t*1.25+f));',
 ice:'float2 p=turn(q,.37);return sat(.14+.50*abs(fract(p.x*2.8+p.y*1.6)-.5)+.58*ridge(min(engraving(atan(p.y,p.x+.00001),6.)*length(p),abs(fract((abs(p.y)+p.x*.52)*5.+.08*t)-.5)),.07));',
 life:'float a=atan(q.y,q.x+.0001);float r=length(q);return .25+.67*ridge(r-.50-.27*cos(a*5.+t*.8),.15)+.08*cos(12.*r-a*5.);',
 acid:'float f=cloud(q*1.75+float2(seed,-t*.38));return .17+.75*cloud(q*2.9+float2(f*1.5+t*.32,f));',
 venom:'float f=cloud(q*2.8+float2(t*.17,-t*.28));return .18+.72*cloud(q*5.+float2(f*3.,f*2.-t*.48));',
 storm:'float f=noiseF(float2(q.x*8.+seed,t*5.))-.5;return .22+.75*ridge(q.y-.46*f-.12*sin(12.*q.x+t*5.),.11);',
 echo:'return .20+.75*ridge(fract(length(q)*3.8-t*.55)-.5,.13);',
 mind:'float a=atan(q.y,q.x+.00001);return .21+.78*ridge(sin(a*2.+length(q)*11.-t*1.7),.28);',
 shade:'float f=cloud(q*3.+seed);return .12+.78*cloud(turn(q,t*.2+f)*5.+float2(seed+t*.19,f*2.));',
 light:'float a=atan(q.y,q.x+.00001);return .28+.68*pow(.5+.5*cos(8.*a+.35*sin(t)),4.);',
 ward:'float2 p=turn(q,.78);return .22+.68*ridge(min(abs(fract(p.x*4.+.03*t)-.5),abs(fract(p.y*4.-.03*t)-.5)),.085);',
 stone:'float2 p=q*3.5;float f=noiseF(floor(p)+seed);return .22+.45*f+.28*ridge(min(fract(p.x),fract(p.y)),.09);',
 prism:'float2 p=turn(q,t*.19);return .23+.73*abs(fract((abs(p.x)*.87+p.y*.5)*3.2)-.5)*2.;'};
const bodies={
 burst:`float g=.14+.82*(1.-exp(-4.4*p));float2 v=q/g;float f=grain(v,t);float edge=length(v)-(.66+.31*f);float veil=1.-smoothstep(-.1,.25,edge);
 float4 c=coat(dye,exp(-r*r/(.04+.65*p))*.58*(1.-p));c=atop(coat(mix(ink,mix(dye,lit,smoothstep(.42,.88,f)),sat(.22+f)),veil*(.89-.51*p)),c);
 float shell=ridge(edge,.045)*(.34+.58*f);c=atop(coat(lit,shell),c);float spokes=step(.5,knobs.x)*pow(.5+.5*cos(a*knobs.x+seed+.08*sin(3.*a)),18.);
 c=atop(coat(mix(dye,lit,.67),spokes*exp(-sq((r-g)/.35))*smoothstep(.12,.57,r)),c);return atop(coat(lit,flare(q/(.28+.29*p))*exp(-p*5.)*knobs.y),c);`,
 shock:`float4 c=float4(0);for(int i=0;i<4;i++){float k=float(i);if(k<knobs.x){float u=sat(p*(1.+(knobs.x-1.)*knobs.y)-knobs.y*k);float front=.05+.95*(1.-pow(1.-u,2.5));float d=r-front;
 float light=ridge(d,.011+knobs.z*.3)+.38*ridge(d+.045,.028);float glint=.51+.49*pow(.5+.5*cos(a*3.-t*2.8+k),2.);
 c=atop(coat(mix(dye,lit,glint),light*(1.-u)*glint*smoothstep(0.,.045,u)),c);}}return c;`,
 area:`float g=.04+.96*smoothstep(0.,.28,p);float d=r/g;float f=grain(q/g,t);return atop(coat(mix(dye,lit,.43),ridge(d-1.,.012)*.85),coat(mix(ink,dye,.43+.43*f),(1.-smoothstep(.84,1.04,d))*(.3+.6*f)*knobs.x));`,
 implode:`float g=1.-.94*p*p;float v=r/max(.12,g);float arc=abs(sin(a*3.+v*4.-p*3.));float coils=ridge(arc,.15)*smoothstep(.05,.35,v)*(1.-smoothstep(.45,1.21,v));float ring=ridge(r-g,.014)*(.25+.7*engraving(a+t,10.));return atop(coat(lit,flare(q/.34)*p*p),atop(coat(dye,coils*.77+ring*.72),coat(ink,exp(-v*v)*.59)));`,
 smoke:`float2 v=(q+float2(-.14*p,.50*p*knobs.x))/(.42+.64*p);if(length(v)>1.52)return float4(0);float n=cloud(v*2.7+float2(seed,.41*t));float bill=cloud(v*5.4+float2(3.*n,n+t*.29));float body=1.-smoothstep(.39,1.30,length(v)+.65*(n-.50)+.30*(bill-.47));
 return coat(mix(ink,mix(dye,lit,.23),sat(.17+.68*n+1.1*(bill-.5)-.17*v.y)),body*(.49+.43*bill)*knobs.y);`,
 debris:`float2 v=q;v.y+=.59*sin(3.14159*p)*knobs.y-.16*p*p;float ang=atan(v.y,v.x+.00001);float lane=floor((ang+3.14159)*knobs.x/6.28318);float n=hash(float2(lane,seed));float dir=(lane+.16+.68*n)*6.28318/knobs.x-3.14159;
 float2 s=turn(v,-dir)-float2((.40+.69*n)*(1.-pow(1.-p,2.2)),0);float2 chip=turn(s,p*(2.+5.*n));float facet=abs(chip.x)*.64+abs(chip.y);float mask=1.-smoothstep(knobs.z*.47,knobs.z,facet);return atop(coat(mix(dye,lit,.24+.58*step(0.,chip.x+.36*chip.y)),mask),coat(dye,exp(-length((s+float2(.06,0))*float2(.43,1.))/max(.012,knobs.z*.45))*(1.-p)));`,
 drift:`float4 c=float4(0);for(int i=0;i<12;i++){float k=float(i);if(k<knobs.x){float h=hash(float2(k,seed));float u=sat((p-.33*h)/(.59+.07*h));float2 v=q-float2((h-.5)*1.55+.13*sin(k+u*5.8),knobs.y*(.51-u*(.76+.36*hash(float2(seed,k)))));
 float d=length(v*float2(1.1,.8));float l=knobs.z>.5&&mod(k,3.)<.5?max(ridge(max(abs(v.x)-.078,abs(v.y)*2.5),.015),ridge(max(abs(v.y)-.078,abs(v.x)*2.5),.015)):exp(-d/(.021+.012*h));c=atop(coat(mix(dye,lit,h),l*sin(3.14159*u)),c);}}return c;`,
 sigil:`float aa=a+t*knobs.z;float n=max(3.,knobs.x);float sector=6.283185/n;float facetEdge=r*cos(mod(aa+sector*.5,sector)-sector*.5);float inset=r*cos(mod(-aa+sector*.78,sector)-sector*.5);
 float lines=ridge(r-.98,.009)+.52*ridge(r-.88,.008)+.64*ridge(facetEdge-.61,.011)+.44*ridge(inset-.54,.008);float teeth=engraving(-a+t*knobs.z*.48,max(4.,knobs.y));float runes=ridge(abs(r-.765)+.10*teeth-.047,.008)*smoothstep(.09,.27,teeth);
 return atop(coat(lit,runes+.65*lines),atop(coat(dye,.31*ridge(r-.93,.07)+.25*ridge(facetEdge-.61,.05)),coat(ink,(1.-smoothstep(.82,1.,r))*.10)));`,
 spiral:`float v=r/(1.08-.83*p*p);float z=sin(a+v*knobs.x*6.28318-t*knobs.y);float e=(1.-smoothstep(.75,1.,v))*smoothstep(.0,.15,v);return atop(coat(lit,ridge(z,.10)*e),coat(dye,(ridge(z,.39)*e*.74+.3*exp(-v*v*4.))));`,
 domain:`float g=max(.03,p);float2 v=q/g;float d=length(v);if(d>1.16)return float4(0);float l=cloud(v*3.4+float2(.16*t,seed));float curl=cloud(turn(v,.44*l)*6.+float2(seed,-t*.21));float band=ridge(d-.98-.034*(l-.5),.018);float cut=1.-smoothstep(.84,1.02,d+.09*(curl-.5));
 float spiral=ridge(sin(2.*a+9.*d-t*.44+3.*l),.25);float silent=knobs.x;float ripple=ridge(fract(d*3.+t*.26)-.5,.065)*smoothstep(.08,.30,d)*(1.-smoothstep(.83,1.,d));
 return atop(coat(lit,band*.61+(silent>.5?ripple*.39:spiral*.14*cut)),coat(mix(ink,dye,.21+.46*curl),cut*(.54+.28*l)));`,
 glow:`float f=exp(-r*r*2.9)*(1.-smoothstep(.91,1.27,r));return coat(mix(dye,lit,.22*f),f*(.82+.18*cos(1.8*t)));`,
 ring:`float g=.97+.026*sin(2.*t);float d=r-g;float aa=a+t*knobs.z;float dash=knobs.y>.5?smoothstep(.08,.24,engraving(aa,17.)):1.;float sweep=.40+.6*pow(.5+.5*cos(aa*2.),4.);return atop(coat(lit,ridge(d,knobs.x*.43)*dash*sweep),coat(dye,.50*ridge(d,.051)+.44*ridge(d+.061,.009)*sweep));`,
 dome:`if(r>1.24)return float4(0);float z=sqrt(max(0.,1.-r*r));float2 v=q/(.65+.35*z)*knobs.x;float2 tile=float2(1.732,1.);float2 h1=mod(v,tile)-tile*.5,h2=mod(v+tile*.5,tile)-tile*.5;float2 h=abs(dot(h1,h1)<dot(h2,h2)?h1:h2);float wall=.5-max(dot(h,float2(.866,.5)),h.y);float sweep=exp(-sq((q.x*.64+q.y*.76-sin(t*.91))/.29));
 float grid=ridge(wall,.033)*(.21+.55*sweep)*(1.-smoothstep(.94,1.,r));float rim=ridge(r-.97,.023)*(.53+.43*sweep);float spec=exp(-length((q+float2(.40,.53))*float2(.78,2.6))*11.);
 return atop(coat(lit,grid+rim+spec*.75),coat(dye,.30*ridge(r-.94,.094)+knobs.y*(1.-smoothstep(.94,1.,r))));`,
 wisps:`float n=cloud(turn(q,.19*t)*4.+seed);float smoke=ridge(r-.78-.27*(n-.49),.19)*(.23+.7*n);return coat(mix(ink,dye,n),smoke*(.52+.48*sin(2.*a-t+3.*n)*sin(2.*a-t+3.*n)));`,
 orbit:`float2 v=float2(q.x,q.y/max(.19,knobs.y));float angle=atan(v.y,v.x+.00001)-t*axis.x;float n=max(1.,knobs.x);float head=mod(angle+3.141593/n,6.283185/n)-3.141593/n;float2 dotP=float2(length(v)-.91,head*.91)/max(.038,knobs.z);float d=length(dotP);float bead=flare(dotP*.5);float trail=ridge(length(v)-.91,.022)*exp(-abs(head)*6.);return atop(coat(lit,bead),coat(dye,.53*trail+exp(-d*1.6)*.6));`,
};
Object.assign(bodies,{
 fault:`float x=dot(q,axis)+.5*knobs.x,y=dot(q,float2(-axis.y,axis.x));float u=x/max(.01,knobs.x);if(abs(y)>1.33||u<-.05||u>1.05)return float4(0);
 float gate=smoothstep(-.045,.02,u)*(1.-smoothstep(p-.025,p+.02,u));float vein=y-(noiseF(float2(x*5.+seed,t*.73))-.5)*.13*sin(3.14159*sat(u));float w=abs(vein);float cell=x*knobs.y+w*.89+.12*sin(12.*w+seed);
 float branch=ridge(fract(cell)-.5,.040)*smoothstep(.015,.18,w)*(1.-smoothstep(.40,1.1,w));float fork=ridge(fract(cell+max(0.,w-.28)*1.47)-.5,.022)*smoothstep(.28,.44,w)*(1.-smoothstep(.57,.85,w));
 float beat=.36+.64*pow(.5+.5*cos(6.28318*(x*.49-t*knobs.z)+w*3.),4.);float pins=ridge(fract(x*knobs.y*2.)-.5,.06)*exp(-w*6.);
 return atop(coat(lit,gate*(ridge(vein,.020)+beat*(branch+fork)+pins*.66)),coat(dye,gate*(.68*ridge(vein,.146)+.43*(branch+fork))));`,
 arcs:`float ang=a+t*.4;float lane=floor((ang+3.14159)*knobs.x/6.28318);float h=hash(float2(lane,seed));float blaze=pow(.5+.5*cos(t*knobs.z*3.4+h*6.28),5.);
 float jag=(noiseF(float2(q.x*18.+q.y*9.+seed,t*3.5))-.5)*.16;float d=r-(.91+jag);float mask=smoothstep(.08,.34,engraving(ang,knobs.x));return atop(coat(lit,ridge(d,.013)*mask*blaze),coat(dye,ridge(d,.050)*mask*blaze*.72));`,
 mineral:`float ang=a+t*knobs.z;float n=knobs.x;float lane=floor(ang*n/6.283185);float f=fract(ang*n/6.283185);float align=.93+.045*cos(ang*n)+.27*(1.-smoothstep(0.,.64,t));float d=(r-align)/max(.07,knobs.y);float rock=(1.-smoothstep(.8,1.,abs(d)))*smoothstep(.018,.11,min(f,1.-f));float textureV=noiseF(q*23.+seed);
 float cut=abs(d*.62+(f-.5)*1.45+.15*sin(lane));float gleam=ridge(cut,.047)*(.35+.65*pow(.5+.5*sin(t*1.6+lane),5.));float facet=sat(.38-.27*d+.31*step(d,(f-.5)*1.5)+.38*(textureV-.5));
 return atop(coat(lit,rock*(gleam+ridge(abs(d)-.81,.12)*.51)),coat(mix(ink,dye,facet),rock*.97));`,
 lens:`float ang=a+t*knobs.x;float teeth=engraving(ang,12.);float fine=ridge(r-.94,.016)*ridge(teeth,.12);float dust=salt(q*18.+float2(seed,t*.54),.10)*(1.-smoothstep(.69,1.,r));float hand=ridge(sin(ang),.033)*smoothstep(.03,.2,r)*(1.-smoothstep(.72,.85,r));
 return atop(coat(lit,.42*fine+.24*hand+.59*dust),coat(dye,.25*exp(-r*r*2.6)*(1.-smoothstep(.87,1.,r))+.24*ridge(r-.99,.012)));`,
 stream:`float x=dot(q,axis)+knobs.x*.5;float y=dot(q,float2(-axis.y,axis.x));float u=x/max(.001,knobs.x);if(u<-.06||u>1.06||abs(y)>knobs.y+4.)return float4(0);
 float limit=smoothstep(0.,knobs.z,p);float env=smoothstep(-.045,.015,u)*(1.-smoothstep(limit-.015,limit+.035,u));float waves=sin(3.14159*sat(u));float wob=knobs.y*waves*WOBBLE;
 float d=abs(y-wob);float branch=abs(y-wob-.58*knobs.y*sin(11.*u-3.*t)*waves);float spark=ridge(fract(u*2.5-t*2.3)-.50,.060);
 return atop(coat(lit,(ridge(d,.36)+.38*ridge(branch,.20)*waves)*env),coat(dye,(ridge(d,1.18)*.80+.25*ridge(d,2.18)*spark)*env));`,
 cone:`float x=dot(q,axis)+.5,y=dot(q,float2(-axis.y,axis.x));float rho=length(float2(x,y));if(x<0.||rho>1.14)return float4(0);float front=.04+.96*(1.-pow(1.-sat(p/.40),3.));float w=max(.035,knobs.x*x);float s=y/w;if(abs(s)>1.32||rho>front+.09)return float4(0);
 float f=grain(float2(x*2.4-t*.7,s*.79),t);float m=(1.-smoothstep(.62,1.18,abs(s)+.22*(f-.5)))*(1.-smoothstep(front-.11,front+.08,rho+.045*(f-.5)));float thread=ridge(abs(s)-.66-.14*sin(15.*x-t*5.),.047);
 return atop(coat(lit,m*(thread*.58+.24*pow(f,3.))),coat(mix(ink,mix(dye,lit,sat(.13+.98*f)),sat(.24+f)),m*(.44+.54*f)));`,
 pillar:`float y=q.y-knobs.x*.5;float u=1.+y/knobs.x;float f=1.-pow(1.-sat(p/knobs.y),3.);float v=noiseF(float2(q.x*2.1+t*.4,y*.63+t*1.5)+seed);float w=.78+.22*u+.15*v;float beam=ridge(q.x+.12*sin(y+t*2.),w*.52);float hair=ridge(abs(q.x)-(.61+.16*sin(2.*y-t*4.)),.065);
 float gate=smoothstep(-.03,.12,u)*(1.-smoothstep(f-.03,f+.035,u));float floorD=length(float2(q.x,y*1.8));float foot=smoothstep(knobs.y,min(.99,knobs.y+.12),p);float plasma=knobs.z*ridge(abs(q.x)-.79,.40)*exp(-abs(y)*.58)*(.25+.75*v)*step(y,0.);
 return atop(coat(lit,(.88*beam+.50*hair)*gate+.62*flare(float2(q.x,y)*1.17)*foot),coat(dye,gate*(beam*.7+hair*.18)+foot*(.53*exp(-floorD*floorD*.50)+plasma)));`,
 comet:`float x=-dot(q,axis),y=dot(q,float2(-axis.y,axis.x));float k=sat(x/max(1.,knobs.x));float end=1.-smoothstep(.58,1.,k);float v=grain(float2(k*1.85-t*.33,y*.73),t);float w=.82-.36*k+.30*(v-.5);float tube=abs(y-.29*sin(12.*k-4.*t)*k);float veil=exp(-sq(tube/max(.17,w)))*smoothstep(-.70,.28,x)*end;
 float helix=ridge(y-(.45+.45*k)*sin(k*13.-t*5.),.14)*veil*knobs.y;float r0=length(q*float2(1.,1.08));float grainHead=grain(q,t);float cap=(1.-smoothstep(.43,.96+.13*grainHead,r0))*knobs.z;
 float4 c=coat(mix(ink,dye,.65+.25*v),veil*.89);c=atop(coat(RIBBON_COLOR,(.52+.38*v)*veil+helix*.67),c);c=atop(coat(lit,cap*(.68+.30*grainHead)),c);return atop(coat(dye,.31*exp(-r0*r0*.46)),c);`,
 dial:`float before=1.-smoothstep(1.42,1.55,t);float rot=t*t*.96;float tick=engraving(a+rot*.14,60.);float marks=ridge(r-.9,.049)*ridge(tick,.19);float gold=ridge(r-.98,.012)+marks+.64*ridge(r-.77,.009);
 float h1=max(0.,dot(q,float2(cos(-rot*2.-1.57),sin(-rot*2.-1.57))));float h2=max(0.,dot(q,float2(cos(-rot*8.-1.57),sin(-rot*8.-1.57))));float hands=ridge(length(q-h1*float2(cos(-rot*2.-1.57),sin(-rot*2.-1.57))),.014)*(1.-smoothstep(.45,.54,r))+ridge(length(q-h2*float2(cos(-rot*8.-1.57),sin(-rot*8.-1.57))),.012)*(1.-smoothstep(.64,.75,r));
 float cover=smoothstep(1.30,1.5,t)*(1.-smoothstep(1.76,2.52,t));float front=max(0.,t-1.76)*3.;float echo=ridge(r-front,.051)*smoothstep(1.76,1.89,t)*exp(-max(0.,t-1.76));return atop(coat(mix(lit,float3(.92,.98,1.),.8),cover),atop(coat(lit,(gold+hands)*before),coat(dye,.25*before*exp(-r*r)+echo)));`,
});
// On fire spells the area is a rolling edge of incandescent gas, not a tinted disk.
const fireArea=`float g=.08+.92*(1.-pow(1.-sat(p/.42),2.3));float2 v=q/g;if(length(v)>1.25)return float4(0);
 float f=grain(v,t);float n=cloud(v*4.2+float2(f*2.3,-t*.51));float rim=length(v)-(.84+.24*(n-.45));float shell=ridge(rim,.077);float gas=sat(.37+.96*(f-.37)+.84*(n-.46)+.28*shell-.40*p);float3 c=mix(float3(.26,.047,.044),dye,smoothstep(.12,.66,gas));c=mix(c,lit,smoothstep(.56,.92,gas));float density=(1.-smoothstep(-.14,.15,rim))*(.63+.37*n);
 return atop(coat(lit,shell*.42*smoothstep(.27,.65,f)),coat(c,density*min(.88,knobs.x*1.61)));`;
const cache=new Map();
export function plate(kind,school='prism'){
 const base=kind==='bolt'||kind==='beam'||kind==='tether'?'stream':kind;
 const seam=school==='threshold'&&['fault','burst','shock'].includes(kind);
 const electric=(school==='electric'&&Object.hasOwn(discharge,kind))||seam;
 // An accent is composited over the ordinary plate. Only particle-only plates have no base.
 const particles=kind==='spearAcid'||kind==='acidSpray'||(school==='acid'&&kind==='drift');
 const accent=(particles||school==='acid')&&dropLayers[kind];
 const body=particles?null:spearBodies[kind]||wardBodies[kind]||(seam&&kind==='fault'?thresholdFault:electric?discharge[kind]:base==='area'&&school==='fire'?fireArea:bodies[base]);if(!body&&!accent)throw Error('Unknown Astra plate: '+kind);
 const type=accent?'acid':electric?school:body.includes('grain(')?school:'flat';const key=kind+':'+type;
 if(!cache.has(key)){
  const wob=kind==='bolt'?'(.79*channel(u*18.+seed,t*6.)+.21*channel(u*41.+seed,t*8.))':kind==='tether'?'sin(13.*u-5.*t)':'(.16*sin(8.*u-3.*t))';
  const paint=body?'float4 paint(float2 q,float p,float t){float r=length(q),a=atan(q.y,q.x+.000001);'+body.replace('WOBBLE',wob).replace('RIBBON_COLOR',kind==='comet'&&type==='prism'?'(.60+.37*cos(float3(0.,2.1,4.2)+k*9.-t*2.6))':'mix(dye,lit,v)')+'}':'';
  const baseCall='paint(q,phase.x,phase.y)',dropCall='drops(q,phase.x,phase.y)';
  const result=!accent?baseCall:particles?dropCall:'atop('+dropCall+','+baseCall+')';
  cache.set(key,lib+(electric?dischargeLib(seam):'')+'\nfloat grain(float2 q,float t){'+(texture[type]||texture.prism)+'}\n'+paint+(accent?dropLib+'float4 drops(float2 q,float p,float t){'+accent+'}':'')+'\nhalf4 main(float2 coord){float2 q=(coord-size*.5)/unit;return half4('+result+'*clamp(phase.z,0.,1.));}');
 }return cache.get(key);
}
