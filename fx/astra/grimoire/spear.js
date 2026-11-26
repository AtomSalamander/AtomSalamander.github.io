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
     else if(i==2){col=float3(.49,.97,.12);float age=fract(.87*t+.11*seed);float dx=x-span*(.19+.61*age);float dy=h-.30-.16*sin(3.14159*age);float d=length(float2(dx/.43,dy/(.14+.06*smoothstep(-.35,.20,dx))));detail=.85*(1.-smoothstep(.70,1.08,d))*sin(3.14159*age);}
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
};
