// Four authored effects. Timings in seconds inside a bounded native plate; no scene mutations.
export const loom={
 rubyCone:`float x=dot(q,axis)+.5,y=dot(q,float2(-axis.y,axis.x));if(x<=0.||x>1.||abs(y)>.5*x)return float4(0);
 float v=y/max(.004,.5*x);float gate=(1.-smoothstep(.98,1.,x))*(1.-smoothstep(.945,1.,abs(v)))*smoothstep(.0,.018,x);
 float front=smoothstep(.075,.38,p);gate*=1.-smoothstep(front-.05,front,x);float f=gas(float2(x*4.6-t*.64,v*2.1));
 float caustic=ridge(sin(v*11.+2.8*f+x*1.6-t*.65),.17);float inner=ridge(v-.12*sin(x*5.-t),.24);
 float shaft=.3+.7*f;float3 ruby=mix(float3(.78,.066,.066),float3(1.,.59,.17),sat(f*.88+.49*inner));
 float4 c=coat(ruby,gate*(.24+.45*shaft));c=over(coat(float3(1.,.88,.57),gate*(caustic*.55+.38*inner)*shaft),c);
 return over(coat(float3(1.,.54,.19),gate*(ridge(abs(v)-.91,.027)*.40+ridge(x-.972,.012)*.35)),c);`,
 loomBeam:`float span=opt.x,x=dot(q,axis)+span*.5,y=dot(q,float2(-axis.y,axis.x));float u=x/max(.001,span);
 if(u<0.||u>1.||abs(y)>1.12)return float4(0);float tip=smoothstep(0.,.16,p);float env=1.-smoothstep(tip-.016,tip+.015,u);
 float fan=(.10+.35*pow(1.-u,2.)+.11*sin(3.14159*u));float4 c=coat(float3(.035,.24,.63),env*.27*exp(-sq(y/.43)));
 for(int i=0;i<5;i++){float j=float(i);float ph=1.25664*j+u*13.-t*5.;float lane=fan*sin(ph)+.065*sin(u*21.+j+t*2.)*sin(3.14159*u);
 float z=.43+.53*(.5+.5*cos(ph));float w=.027+.022*z;float d=y-lane;float3 col=mix(float3(.065,.41,1.),float3(.56,1.,1.),j*.25);
 c=over(coat(col,env*z*(ridge(d,w*2.7)*.56+ridge(d,w))),c);c=over(coat(ice,env*z*ridge(d,w*.42)*.66),c);}
 return c;`,
 // A sheet of woven light in log-polar coordinates. The outer field holds while its
 // fibres accelerate inward; a second, counter-wound family crosses over and under it.
 unravel:`if(r>1.12)return float4(0);float pull=smoothstep(.95,5.05,t);float arrival=smoothstep(0.,1.55,t);float pinch=smoothstep(4.47,5.32,t);
 float rr=max(.003,r);float logR=log(rr);float field=(1.-.974*pinch);float reach=field*(.60+.46*arrival);float boundary=1.-smoothstep(.82*reach,1.06*reach,r);
 float inner=(.31-.29*pull)*field;float throat=smoothstep(inner*.51,inner+.023,r);float bend=(.78+.91*pull)*logR;
 float haze=gas(float2(q.x*3.+seed-t*.17,q.y*4.+t*.25));float w=sin(3.*a-rr*9.+t*.55)*.24+sin(5.*a+rr*3.)*.09;
 float warp=(a+bend+w*.57+.115*t)*1.27324;float weft=(a-bend*.74+w+.08*t)*1.75070;
 float f=abs(fract(warp+.5)-.5)*rr, g=abs(fract(weft+.5)-.5)*rr;
 float sel=sin(6.283185*(warp+weft)*.5);float near=f<g?1.:0.;float depth=.3+.7*smoothstep(-.7,.7,sel*(near*2.-1.));
 float groove=min(f,g);float hot=pow(.5+.5*cos(8.*logR+t*(2.8+.5*t)+seed+.55*sin(a*4.)),5.);
 float shell=boundary*throat*arrival;float4 c=coat(float3(.012,.038,.12),shell*(.14+.17*haze));
 c=over(coat(mix(float3(.09,.27,.78),float3(.03,.73,.93),near),shell*(.32+.35*haze)*ridge(groove,.025+.009*pull)),c);
 c=over(coat(mix(float3(.31,.60,.93),float3(.71,1.,1.),near),shell*ridge(groove,.0040)*(depth+.35*hot)),c);
 float beads=hot*ridge(groove,.008)*boundary*throat;return over(coat(ice,beads*.79*arrival),c);`,
 // Flattened accretion band tilted past a dark globe; eclipses drawn back to front.
 eventHorizon:`float gather=smoothstep(.65,4.18,t),pinch=smoothstep(4.45,5.32,t);float rad=(.09+.52*gather)*(1.-.971*pinch);
 float vanish=1.-smoothstep(5.27,5.48,t);float2 coord=rot(q,-.21);float2 e=coord/float2(1.,.30);float ell=length(e)/max(.014,rad);float theta=atan(e.y,e.x+.00001);
 float n=gas(float2(theta*1.6+seed-t*.58,ell*3.-t*.6));float braid=ridge(ell-1.38-.11*sin(theta*3.-t+n),.075)+.49*ridge(ell-1.74+.10*n,.040);
 float band=exp(-sq((ell-1.43)/.46));float power=gather*vanish;float3 cold=mix(float3(.15,.23,.74),float3(.48,.95,1.),n);
 float4 belt=over(coat(ice,power*braid*(.34+.62*n)),coat(cold,power*band*(.28+.56*n)));
 float sphere=r/max(.014,rad);float edge=ridge(sphere-.97,.055);float g=exp(-sq((sphere-1.)/.29));float4 globe=coat(float3(.012,.019,.067),power*(1.-smoothstep(.90,1.035,sphere))*.95);
 globe=over(coat(float3(.095,.53,1.),power*(.64*g+.36*ridge(sphere-1.12,.048))),globe);globe=over(coat(ice,power*edge*.91),globe);
 float4 c=coord.y<0.?over(globe,belt):over(belt,globe);
 float peak=exp(-sq((t-5.32)/.13));c=over(coat(float3(.87,.98,1.),peak*glint(q/(.30+.48*peak))),c);
 float after=max(0.,t-5.32);float ghost=(1.-smoothstep(.02,1.75,after))*smoothstep(.0,.11,after);
 if(opt.x>.5){float slit=exp(-abs(coord.x)*68.-abs(coord.y)*3.6);c=over(coat(float3(.47,.81,.97),slit*ghost),c);}
 else{float fil=ridge(ell-1.-after*13.,.45)*exp(-r*2.1);c=over(coat(ice,ghost*.45*(fil+exp(-r*r*7.))),c);}return c;`,
 residue:`float after=t;float wave=1.-exp(-1.37*after);float d=r-wave;float m=1.-smoothstep(.62,1.03,r);
 float tw=sin(a*11.+t*1.9+r*8.)*.018;float s=ridge(d-tw,.009)*(.35+.65*pow(.5+.5*cos(a*4.-t),2.));
 float tiles=hex(rot(q,.26)*9.+float2(t*.13,0.));float grain=ridge(tiles,.024)*exp(-sq((d+.10)/.083));float4 c=coat(dye,(s+.5*grain)*m*(1.-p));
 return over(coat(ice,ridge(d,.007)*.53*(1.-p)),c);`,
 relic:`float2 v=rot(q,t*.12);float d=abs(v.x)*.84+abs(v.y)*.62;float h=gas(v*6.+float2(seed,t*.28));float cut=abs(v.y-.36*v.x-.09*sin(v.x*10.+t*.42));
 float gem=1.-smoothstep(.57,.61,d);float facets=.18+.46*step(0.,v.x+.36*v.y)+.17*step(v.y,.28*v.x);float beam=ridge(cut,.026)*(.5+.5*h);
 float4 c=coat(float3(.05,.22,.34),gem*.52);c=over(coat(mix(float3(.12,.40,.61),dye,facets),gem*(.20+.25*h)+.65*ridge(d-.60,.018)),c);
 c=over(coat(ice,gem*beam+.76*ridge(d-.60,.009)),c);float oval=length(rot(q,.13)*float2(.86,1.3));return over(coat(dye,.40*ridge(oval-.90,.019)),c);`,
};
// Read the existing map once. Only the neighbourhood of the target is refracted;
// no pan, no zoom, no white screen. Locations in world coordinates, samples in view pixels.
export const eraseGrade=`uniform float2 size;uniform float3x3 view;uniform shader scene;uniform float3 focus;uniform float3 phase;
half4 main(float2 coord){float2 px=(float3(coord,1)*view).xy;float2 v=(coord-focus.xy)/max(1.,focus.z);float r=length(v);float t=phase.y;
 float inrush=smoothstep(.1,3.9,t)*(1.-smoothstep(5.05,5.56,t));float rest=1.-smoothstep(5.33,7.3,t);float shade=smoothstep(.0,2.7,t)*rest;
 float warp=exp(-dot(v,v)*1.8)*inrush;float2 flow=(v*.18+float2(-v.y,v.x)*.10)*warp;float2 samplePx=(float3(coord+focus.z*flow,1)*view).xy;
 half4 s=scene.eval(clamp(samplePx,float2(.5),max(float2(.5),size-.5)));float light=max(s.r,max(s.g,s.b));float vign=.17+.13*clamp(length((px/size-.5)*1.45),0.,1.);
 s.rgb*=1.-shade*vign*(1.-smoothstep(.45,.98,light))*float3(.97,.88,.65);return s;}`;
