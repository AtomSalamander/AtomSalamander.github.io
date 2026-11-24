// Unique to Chromatic Spear. The three vector facets of the original weapon sit above the trail.
// One bounded plate for the five strands instead of one local scene item per particle.
export const spearBodies = {
 fivefold:`float x=-dot(q,axis), y=dot(q,float2(-axis.y,axis.x));float span=knobs.x;
 if(x<-.7||x>span||abs(y)>3.15)return float4(0);
 float u=sat(x/span);float born=1.-smoothstep(knobs.z*p+.05,knobs.z*p+.65,x);
 float end=1.-smoothstep(.75,1.,u);float spread=(.13+1.38*smoothstep(.025,.36,u))*(1.-.30*u);
 float4 c=coat(float3(.31,.23,.72),.18*exp(-abs(y)*1.17)*end*smoothstep(-.55,.50,x));
 // Back and front halves cross in depth like the beaded helical trails of v1.9.
 for(int pass=0;pass<2;pass++){for(int i=0;i<5;i++){
   float j=float(i);float angle=6.283185*(.2*j+.99*u)-t*5.8;float depth=cos(angle);
   if((pass==0&&depth<0.)||(pass==1&&depth>=0.)){
     float cy=spread*sin(angle);float h=y-cy;float width=.115+.070*(.5+.5*depth);
     float3 col=float3(1.,.30,.045);float detail=0.;float pulse=.8+.2*cos(21.*u-t*6.+j);
     if(i==0){h-=.12*channel(x*1.15,t*3.1);width*=1.25;detail=.48*salt(float2(1.3*x-t*3.,2.7*h+seed),.21)*exp(-abs(h)*1.8);}
     else if(i==1){col=float3(.22,.86,1.);float facet=abs(fract(x*.53+t*.9)-.5)*1.65+abs(h)*1.6;detail=.8*(1.-smoothstep(.10,.30,facet));}
     else if(i==2){col=float3(.49,.97,.12);float dx=(fract(x*.79+t*.7)-.5)/.79;float bubble=length(float2(dx,h-.20));detail=.88*ridge(bubble-.145,.058);}
     else if(i==3){col=float3(1.,.78,.10);h-=.45*channel(x*1.75+seed,floor(t*3.5));width*=.83;}
     else{col=float3(.72,.47,1.);float dx=fract(x*.47+t*.68)-.5;detail=.66*ridge(length(float2(dx*.92,h))-.31,.06);}
     float power=(.72+.22*depth)*end*smoothstep(-.30,.38,x)*pulse;
     c=atop(coat(col,power*.49*ridge(h,width*3.6)),c);
     c=atop(coat(col,power*(ridge(h,width)+detail)),c);
     c=atop(coat(mix(col,float3(1.),.49),power*.72*ridge(h,width*.38)),c);
   }
 }}
 return born*atop(coat(float3(1.,.94,.86),flare(float2(x,y)*2.4)*.84),c);`,
 spearFrost:`float4 c=float4(0);for(int i=0;i<9;i++){
   float j=float(i),h=hash(float2(j,seed+1.));float k=(j+.45*h)*.69813;float dist=(.48+.55*h)*(1.-pow(1.-p,2.4));
   float2 v=turn(q,-k)-float2(dist,0.);float len=.095+.085*h;float shape=abs(v.x)/len+abs(v.y)/(.032+.029*h);
   float edge=1.-smoothstep(.82,1.06,shape);float side=smoothstep(-.012,.012,v.y+.12*v.x);
   c=atop(coat(mix(float3(.17,.64,.98),float3(.85,.99,1.),side),edge),c);
 }return c;`,
 spearAcid:`float4 c=float4(0);for(int i=0;i<7;i++){
   float j=float(i),h=hash(float2(seed,j+17.));float k=(j+h*.48)*.89760;
   float age=sat((p-.075*h)/(.77+.14*h));float d=(.42+.59*h)*(1.-pow(1.-age,2.8));
   float2 v=turn(q-float2(0.,.22*age*age),-k)-float2(d,0.);float rad=(.050+.043*h)*(1.-.43*age);
   float g=length(v*float2(.78,1.))/rad;float mask=(1.-smoothstep(.78,1.13,g))*(1.-age*age);
   float4 drop=coat(mix(float3(.28,.73,.045),float3(.69,1.,.17),sat(g*.86)),mask);
   drop=atop(coat(float3(.94,1.,.58),mask*exp(-length(v/rad+float2(.29,.24))*4.)),drop);
   c=atop(drop,c);
 }return c;`,
};
