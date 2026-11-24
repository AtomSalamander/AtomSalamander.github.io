// Астра · солнечный шов. All colors returned by these SkSL materials are premultiplied.
// Small analytic impostors rather than a full-screen volume march. No textures to download.
const common = `
uniform float2 size;
uniform float age;
uniform float seed;
float sat(float x){return clamp(x,0.,1.);}
float hash21(float2 p){float3 a=fract(float3(p.x,p.y,p.x)*float3(.1031,.11369,.13787)); a+=dot(a,a.yzx+19.19);return fract((a.x+a.y)*a.z);}
float lattice(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+float2(1,0)),f.x),mix(hash21(i+float2(0,1)),hash21(i+1.),f.x),f.y);}
float mist(float2 p){float v=.55*lattice(p);p=float2(1.77*p.x-1.19*p.y,1.19*p.x+1.77*p.y)+8.3;v+=.27*lattice(p);p=float2(1.64*p.x+1.37*p.y,-1.37*p.x+1.64*p.y)+4.7;v+=.13*lattice(p);return v+DETAIL;}
float3 heat(float k){k=sat(k);float3 c=mix(float3(.115,.024,.034),float3(.83,.125,.026),smoothstep(.03,.43,k));c=mix(c,float3(1.,.56,.105),smoothstep(.38,.73,k));return mix(c,float3(1.,.965,.76),smoothstep(.68,1.,k));}
float4 coat(float3 c,float a){a=sat(a);return float4(c*a,a);}
float4 over(float4 top,float4 under){return top+under*(1.-top.a);}
// Moving points on a stratified grid; cost is independent of the number of visible cinders.
float grains(float2 p,float key,float width){float2 id=floor(p);float h=hash21(id+key);float2 q=fract(p)-(.18+.64*float2(h,hash21(id+key+32.)));return (1.-smoothstep(width*.2,width,length(q*float2(1.5,.63))))*smoothstep(.36,.75,h);}
float fissure(float2 p){float a=8.,b=8.;float2 id=floor(p),f=fract(p);for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){float2 c=float2(float(i),float(j));float2 q=c+.14+.72*float2(hash21(id+c),hash21(id+c+37.))-f;float d=dot(q,q);b=min(b,max(d,a));a=min(a,d);}}return sqrt(b)-sqrt(a);}
`;

// This is the only scene read. Refraction displaces the *existing map*, not the camera.
export const grade = `uniform float2 size; uniform float3x3 view; uniform shader scene;
uniform float age; uniform float3 gate; uniform float exposure;
half4 main(float2 coord){
  float2 px=(float3(coord,1)*view).xy;float2 uv=px/size;
  float2 p=(coord-gate.xy)/gate.z; float d=length(p*float2(2.2,7.));
  float veil=smoothstep(0.,1.5,age)*(1.-smoothstep(5.1,10.2,age));
  float ripple=(1.-smoothstep(.8,1.85,d))*smoothstep(.12,.65,d)*sin(27.*d-age*5.)*veil*(1.-smoothstep(4.,5.8,age));
  half4 s=scene.eval(px+float2(p.x,p.y*3.)*ripple*7.);
  float l=max(s.r,max(s.g,s.b)); float edge=clamp(length((uv-.5)*1.5),0.,1.);
  float shade=veil*(.34+.36*edge)*(1.-smoothstep(.58,.99,l));
  s.rgb*=1.-shade*float3(.98,.88,.67);s.rgb+=float3(.14,.072,.027)*exposure*(1.-s.rgb)*s.a;
  return s;
}`;

const gate = `
half4 main(float2 coord){
 float2 p=(coord/size-.5)*float2(2.,1.0); float t=age;
 float opening=smoothstep(.03,1.65,t)*(1.-smoothstep(3.92,5.65,t)); if(opening<.002)return half4(0);
 p.y+=.073*p.x; p.x/= .18+.82*sqrt(opening);
 float rim=(1.-pow(min(1.,abs(p.x)/.84),1.55));float depth=.132*rim*opening;
 float wob=(mist(float2(p.x*8.+.15*t,seed))-.5)*.105+(lattice(float2(p.x*31.-.17*t,4.))-.5)*.025;
 p.y-=wob*opening;float cut=abs(p.y)-depth;
 float4 col=coat(float3(.17,.085,.26),.38*exp(-max(0.,cut)*15.)*exp(-p.x*p.x*2.)*opening);
 float reach=1.-smoothstep(.64,.99,abs(p.x));
 float2 flow=float2(p.x*3.6,p.y*12./(.42+opening));
 float curl=mist(flow+float2(t*.23,-t*.29));float vapor=mist(flow*2.7+float2(2.8*curl-t*.39,3.5*curl));
 float membrane=1.-smoothstep(-.004,.012,cut);
 float lip=exp(-abs(cut)*104.);float fold=abs(fract(curl*3.1+vapor*.85+p.y*2.)-.5)*2.;
 float core=sat(.12+.36*vapor+.31*curl+.20*(1.-fold)+.42*lip-.28*exp(-abs(p.y)*23.));
 float3 gas=heat(core);gas=mix(float3(.095,.052,.145),gas,smoothstep(.20,.64,vapor+.17*lip));
 col=over(coat(gas,membrane*reach*opening),col);
 // Magnetically folded sheets of incandescent gas outside the photosphere.
 float line=exp(-abs(cut)*74.)+.53*exp(-abs(cut-(curl-.27)*.13)*150.)+.27*exp(-abs(cut-.05-.033*sin(12.*p.x+t))*190.);
 float arches=0.;
 for(int j=0;j<4;j++){float i=float(j),gx=-.58+i*.32+.025*sin(t*.6+i);float2 loop=(p-float2(gx,-depth*.76))*float2(1.,1.47);
  float ld=length(loop)-(.069+.032*sin(i*2.+t*.4));
  arches+=exp(-abs(ld+(vapor-.5)*.017)*225.)*(1.-smoothstep(-.09,.01,p.y))* (.45+.32*sin(i+loop.x*19.));}
 col=over(coat(float3(.99,.48,.20),arches*opening),col);
 float light=sat(line*reach*(.66+.54*vapor)); col=over(coat(heat(.63+.35*light),light*opening),col);
 float disc=exp(-abs(p.y+.04*sin(4.*p.x+t*.24))*(80.+50.*abs(p.x)))*reach;
 col=over(coat(float3(1.,.71,.36),disc*.74*opening),col);
 float halo=exp(-abs(cut)*24.)*reach;col=over(coat(heat(.66),halo*.23*opening),col);
 float sparks=grains(float2(p.x*51.+t*1.7,p.y*74.+t*4.2+curl),11.,.125)*exp(-abs(cut)*9.);
 col=over(coat(float3(1.,.84,.56),sparks*opening*reach),col);
 return half4(col);
}`;

const comet = `
uniform float2 head;uniform float2 old;uniform float2 mid;uniform float unit;
uniform float strength;uniform float wake;uniform float body;uniform float2 axis;
half4 main(float2 coord){
 float2 p=(coord-head)/unit;float2 tail=(old-head)/unit;float2 m=(mid-head)/unit;float d2=max(.001,dot(tail,tail));
 float s=clamp(dot(m,tail)/d2,.04,.96);float2 bend=(m-s*tail)/max(.16,4.*s*(1.-s));
 float k=sat(dot(p,tail)/max(.001,dot(tail,tail)));float2 curve=k*tail+4.*k*(1.-k)*bend;
 float2 normal=float2(-axis.y,axis.x);float across=dot(p-curve,normal);
 float dist=length(p-curve);float l=length(p);float spread=.73+.65*k;
 if(dist>3.1*spread && l>3.8)return half4(0);
 float t=age; float4 outc=float4(0);float2 uv=float2(across*1.5,k*(2.5+length(tail)*.29)-t*1.7);
 float v=mist(uv+seed);float turb=mist(uv*2.6+float2(v*3.,-t*.42)+seed);
 float fade=(1.-smoothstep(.56,1.,k))*wake;float field=dist/spread+(v-.52)*1.18+(turb-.5)*.48;
 float smoke=(1.-smoothstep(.55,1.72,field))*fade;float3 soot=mix(float3(.102,.08,.108),float3(.39,.30,.29),turb);
 outc=coat(soot,smoke*.84);
 float flame=(1.-smoothstep(.05,1.42,field))*fade*strength;
 outc=over(coat(float3(1.,.34,.07),exp(-dist*dist*.85)*fade*.41*strength),outc);
 float ridges=1.-abs(2.*fract(turb*2.+v)-1.);float luminous=sat(.9-.49*field+.28*ridges-.48*k+.27*(v-.5));
 outc=over(coat(heat(luminous),flame),outc);
 float slip=abs(across)-(.68+.56*k+.27*sin(k*15.-t*2.+seed));
 outc=over(coat(heat(.8-.28*k),exp(-abs(slip)*9.)*fade*(.32+.55*turb)*strength*(1.-smoothstep(.2,1.42,dist))),outc);
 float sparks=grains(float2(across*3.8,k*(7.+length(tail))*.8-t*5.)+seed,8.,.13);
 outc=over(coat(heat(.8),sparks*fade*(1.-smoothstep(1.,3.,dist/spread))),outc);
 if(body>.001 && l<3.8){
  outc=over(coat(float3(1.,.235,.046),exp(-l*l*1.16)*.62*body),outc);
  float a=atan(p.y,p.x+.00001);float roll=t*(.44+.053*seed);float shape=.90+.08*sin(3.*a+seed+roll)+.065*cos(5.*a-roll)+.038*sin(9.*a+seed);
  float edge=l-shape;float bow=dot(p,axis)/max(.001,l);float skin=exp(-abs(edge-.07)*19.)*(.45+.45*bow);
  outc=over(coat(float3(1.,.75,.31),skin*body),outc);
  if(edge>-.08 && edge<.65){
   float vent=pow(.5+.5*cos(a*3.-roll+seed+.35*sin(5.*a+t)),17.);
   float plume=vent*(.71+.29*sin(t*5.+a*9.))*exp(-max(0.,edge)*6.);
   outc=over(coat(heat(.62+.30*plume),plume*body),outc);
  }
  if(edge<.075){float z=sqrt(max(0.,1.-l*l/(shape*shape)));float2 tex=float2(p.x*cos(roll)+z*sin(roll),p.y+.17*sin(roll))*2.3+seed;
   float rock=mist(tex*3.3);float vein=fissure(tex+float2(rock*.36,lattice(tex*4.)*.33));
   float lava=exp(-vein*(10.+19.*lattice(tex*7.)));float bevel=exp(-vein*6.2);
   float lighting=sat(.28-.46*p.x-.68*p.y+.31*z);float3 basalt=mix(float3(.11,.067,.072),float3(.53,.39,.32),lighting*(.3+.8*rock));
   basalt+=float3(.31,.088,.021)*bevel+float3(.32,.047,.009)*pow(max(0.,bow),2.)*(1.-z);float3 c=mix(basalt,heat(.66+.29*lava+.04*sin(t*3.+seed)),lava);
   c=mix(c,heat(.91),exp(-abs(edge)*20.)*(.62+.26*bow));
   outc=over(coat(c,(1.-smoothstep(-.025,.055,edge))*body),outc);
  }
 }
 return half4(outc);
}`;

const impact = `
uniform float2 origin;uniform float unit;uniform float radius;uniform float form;
// Projected caps of intersecting plumes. Depth and surface slope light the rolling smoke from below.
float cap(float2 p,float2 c,float2 r){float2 d=(p-c)/r;return 1.-dot(d,d);}
float4 column(float2 p,float t){
 float grow=.12+.88*(1.-exp(-t*4.6)); float lift=(.12+.28*t)*(1.-exp(-t*3.));
 float2 at=p+float2(-.036*t*t/(1.+t),lift);at.x+=.10*sin(at.y*3.+seed+t*.7)*smoothstep(.0,1.,t);
 float2 q=at/(grow*float2(.76+.21*cos(form*2.),.83+.27*sin(form*2.)));
 if(length(q*float2(.81,.72))>1.68)return float4(0);
 float2 uv=q*3.+float2(seed,t*.51);float f=mist(uv);float v=mist(uv*2.7+float2(f*2.2,t*.24+f));
 float2 w=q+float2(f-.49,v-.49)*.49;
 float shell=cap(w,float2(0,-.16),float2(.76,.81));
 for(int j=0;j<7;j++){
  float i=float(j);float ang=i*.8976+seed*.41;float rand=hash21(float2(i,seed));
  float2 center=float2(cos(ang)*(.52+.13*rand),sin(ang)*(.48+.18*rand)-.16);
  float rad=.37+.22*rand; shell=max(shell,cap(w,center,float2(rad,rad*(1.1+.13*sin(ang))))*.82);
 }
 shell+=(v-.5)*.52; if(shell<-.20)return float4(0);
 float z=sqrt(sat(shell));float billow=mist(uv*1.6+float2(z*1.52+f,t*.26-z*.88));
 float folds=1.-abs(billow*2.-1.);float lit=sat(.28+.31*z+.23*billow+.19*w.y-.21*w.x);
 float burn=sat(1.02-.41*t+.26*w.y+.13*z+.79*(billow-.5)+.66*(v-.5));
 float grit=SMALL_EDDIES;
 float relief=sat(.23+.49*lit+.95*(billow-.49)+.63*(v-.48)+.46*(grit-.5));
 float3 smoke=mix(float3(.072,.065,.093),float3(.58,.48,.45),relief);
 // Remnant of hot gas shining through creases on the underside, then cold rose-grey ash.
 float3 flame=heat(sat(.11+.88*burn+.47*(v-.5)+.58*(billow-.5)-.2*abs(shell-.4)));
 float3 color=mix(smoke,flame,smoothstep(.08,.72,burn));
 float rim=(1.-smoothstep(.02,.26,abs(shell)))*sat(1.2-t*.55);color+=float3(.19,.065,.014)*rim;
 float a=smoothstep(-.18,.24+.22*smoothstep(1.,3.,t),shell)*smoothstep(0.,.052,t)*(1.-smoothstep(2.0,4.75,t));
 return coat(color,a*(.94-.20*smoothstep(1.,3.,t)));
}
// Angularly stratified ejecta. Invert the ballistic arc: a fragment stays in its lane
// even as gravity bends the path. No per-fragment scene items or JS integration.
float4 eject(float2 p,float t,float key,float layer){
 float launch=max(0.,t-.025*layer);float2 q=p;q.y+=launch*(1.4-.28*layer)-launch*launch*.96;
 q.y/= .61+.1*layer;float a=atan(q.y,q.x+.00001)+3.141593;
 float n=26.+layer*11.;float cell=floor(a*n/6.283185+key);float rnd=hash21(float2(cell,key));
 float theta=(cell+.18+.64*rnd-key)*6.283185/n-3.141593;
 float2 dir=float2(cos(theta),sin(theta));float speed=1.34+2.95*hash21(float2(key+4.,cell));
 float travel=speed*launch/(1.+launch*.5);float2 off=q-dir*travel;
 float angle=launch*(3.+rnd*5.);float2 loc=float2(dot(off,dir),dot(off,float2(-dir.y,dir.x)));
 float width=.014+.029*rnd*(1.-.26*layer);float taper=sat(1.-launch/(1.37+.51*rnd));
 float streak=length(float2((loc.x+.10*taper)*.17,loc.y));float hot=exp(-streak/max(.001,width)*2.)*taper;
 float shard=abs(loc.x*cos(angle)-loc.y*sin(angle))*.66+abs(loc.x*sin(angle)+loc.y*cos(angle));
 float solid=(1.-smoothstep(width*.51,width,shard))*taper;
 return over(coat(mix(float3(.16,.082,.075),heat(.78),rnd),solid),coat(heat(.70+.29*rnd),hot*1.34));
}
half4 main(float2 coord){
 float2 p=(coord-origin)/unit; float t=age; float r=length(p);float ground=length(p*float2(1.,1.56));
 float wave=length(coord-origin)/radius;float4 c=float4(0);
 if(t<0.){float pre=smoothstep(-2.2,-.08,t);if(pre<.001 || r>1.6)return half4(0);
  float pen=exp(-ground*ground*3.4);float ring=exp(-abs(ground-.40-.1*sin(4.*t))*17.);
  return half4(over(coat(float3(.96,.38,.10),ring*.20*pre),coat(float3(.09,.038,.08),pen*pre*.67)));}
 float endFade=1.-smoothstep(3.1,5.05,t);if(endFade<.001)return half4(0);
 // Clean compression front at the rules radius; the broad dusty skirt trails behind it.
 float u=1.-exp(-t*3.15);float front=wave-u;float ring=exp(-abs(front)*105.)*(1.-smoothstep(.35,1.55,t));
 float wakeFog=exp(-abs(front+.054)*14.)*(1.-smoothstep(.09,1.4,t));
 if(wave<1.18 && (ring+wakeFog)>.006){float gust=lattice(p*5.7+seed);c=coat(float3(.77,.49,.32),wakeFog*(.15+.29*gust));c=over(coat(float3(1.,.77,.43),ring*(.35+.48*gust)),c);}
 if(r>4.1)return half4(c);
 float ember=exp(-ground*ground*.57)*(.89*exp(-t*1.33)+.23*endFade);c=over(coat(heat(.60),ember),c);
 if(ground<1.45){float2 bed=p*float2(1.,1.56);float n=mist(bed*4.+seed);float edge=ground+.20*(n-.51);
  float scar=(1.-smoothstep(.34,.89,edge))*endFade*smoothstep(0.,.20,t);
  float3 stone=mix(float3(.06,.042,.066),float3(.25,.137,.124),n);float seam=fissure(bed*4.+.48*n+seed);
  float lava=exp(-seam*42.)*(1.-smoothstep(.2,1.1,edge))*(.22+.68*exp(-.46*t));
  c=over(coat(mix(stone,heat(.70+.23*lava),lava),scar*.88),c);}
 if(t<2.8 && ground<2.65){float2 dust=p*float2(1,1.56);float field=mist(dust*4.+float2(seed,t*.45));
  float torus=abs(ground-(.14+1.62*(1.-exp(-2.1*t)))+(field-.5)*.43);
  float density=exp(-torus*torus/(.012+.057*t))*(1.-smoothstep(.42,2.8,t))*smoothstep(0.,.17,t);
  c=over(coat(mix(float3(.26,.19,.22),float3(.79,.51,.35),field),density*.78),c);}
 if(t<2.05){c=over(eject(p,t,seed+2.,0.),c);SECOND_EJECTA}
 c=over(column(p,t),c);
 // A short local white core with a horizontal diffraction spike, not a white screen.
 if(t<.72){float flash=exp(-t*8.5)*smoothstep(0.,.026,t);float lens=exp(-r*r/(.029+.63*t))+exp(-abs(p.y)*63.-abs(p.x)*2.)*.89;
 c=over(coat(float3(1.,.954,.77),flash*lens*1.42),c);}
 if(r<2.8){float flow=sin(p.y*2.1+seed+t*.86)*.87;float2 g=float2(p.x*14.+flow-t*.53,p.y*15.+t*(3.8-.61*t));
  float loft=exp(-dot(p+float2(0.,.45),p+float2(0.,.45))*.81);float sparks=grains(g,seed,.115)*loft*endFade*smoothstep(.18,.71,t);
  c=over(coat(mix(heat(.85),float3(.62,.56,.59),smoothstep(2.,4.5,t)),sparks),c);}
 return half4(c);
}`;

export function materials(quality=1){
 const lib=common.replace('DETAIL',quality<.8?'.025':'.05*lattice(p*2.19+7.)');
 const blast=impact.replace('SECOND_EJECTA',quality<.8?'':'c=over(eject(p,t,seed+9.,1.),c);')
                   .replace('SMALL_EDDIES',quality<.8?'v':'mist(uv*4.8+float2(2.*z,billow*2.))');
 return { grade, gate:lib+gate, comet:lib+comet, impact:lib+blast };
}
