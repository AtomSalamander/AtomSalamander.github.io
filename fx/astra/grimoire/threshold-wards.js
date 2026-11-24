// Each plate is bounded to a cast or token. No scene reads, persistent map objects or textures.
export const thresholdFault=`
 float span=max(.001,knobs.x);float x=dot(q,axis)+span*.5,y=dot(q,float2(-axis.y,axis.x));float u=x/span;
 if(u<0.||u>1.||abs(y)>1.32)return float4(0);
 float gate=1.-smoothstep(p-.018,p+.012,u);if(gate<.001)return float4(0);
 float n=clamp(span*2.5,7.,32.);float env=smoothstep(0.,.06,u)*(1.-smoothstep(.93,1.,u));
 float cut=trunk(u,n,24.,.34);float w=(.038+.090*(.5+.5*zig(u,n,13.)))*env;
 float yy=y-cut;float pulse=exp(-sq((fract(u*.98-t*knobs.z*.7+.5)-.5)/.14));
 float4 c=coat(float3(.07,.46,.92),(.23+.18*pulse)*exp(-abs(yy)*5.));
 c=atop(coat(float3(.025,.035,.095),.93*(1.-smoothstep(w*.5,w+.016,abs(yy)))*env),c);
 // The two lips share a fixed crack. Side leaders strike outward; a bright knot runs along the cut.
 for(int j=0;j<2;j++){float s=j==0?-1.:1.;float d=yy-s*w;
  c=atop(arcLight(d,.027+.016*pulse,.73,.83+.16*pulse),c);
  float cells=clamp(span*knobs.y,3.,12.);float cell=floor(min(.9999,u)*cells);
  float h=hash(float2(cell+seed,19.+float(j)*13.));float root=(cell+.08+.24*h)/cells;
  float du=(u-root)*cells;float life=du/(.37+.31*h);
  if(life>0.&&life<1.){float k=cell*4.+float(j)*23.+strikeKey(t+.17*h,2.4);
   float rootEnv=smoothstep(0.,.06,root)*(1.-smoothstep(.93,1.,root));
   float rootY=trunk(root,n,24.,.34)+s*(.038+.090*(.5+.5*zig(root,n,13.)))*rootEnv;
   float arm=.44+.48*h;float v=s*(y-rootY)-life*arm;
   c=atop(forked(life,v,1.,.19,5.,k,.029*(1.-.55*life),.28,(.46+.53*pulse)*(1.-smoothstep(.72,1.,life))),c);
  }
 }
 float spark=flare(float2((u-fract(t*knobs.z*.7))*span,yy)*3.4);
 return gate*atop(coat(float3(.73,.98,1.),spark*.77),c);`;

export const wardBodies={
 // Loose luminous cloth, not a wire sphere: asymmetric rising folds and gilded stitches.
 faithVeil:`float e=smoothstep(.02,.90,t);float v=(a+3.141593)/6.283185;float h=.84+.055*sin(3.*a+t*.65)+.035*sin(5.*a-t*.44);
 float reveal=smoothstep(-.18,.11,e*1.48-.50+.55*q.y);float4 c=float4(0);
 for(int i=0;i<3;i++){float j=float(i);float wave=sin(2.*a-t*.68+j*2.094);float d=r-(h+.10*wave+.045*j);
  float fold=.20+.8*smoothstep(-.65,.64,cos(a*2.-t*.68+j*2.094));float edge=ridge(d,.017);float band=exp(-sq((d+.027)/.064));
  c=atop(coat(mix(float3(.94,.46,.09),dye,.55),fold*band*.58),c);
  c=atop(coat(mix(dye,lit,.7),edge*fold*.90),c);}
 float n=12.;float cell=floor(v*n);float f=fract(v*n)-.5;float k=hash(float2(cell,seed));float at=.82+.22*k+.047*sin(t*1.2+cell);
 float diam=abs(f)*.57+abs(r-at);float gleam=pow(.5+.5*cos(t*1.8+k*6.28),2.);c=atop(coat(lit,(1.-smoothstep(.013,.036,diam))*(.18+.82*gleam)),c);
 return c*reveal;`,
 // A fast local impact on an otherwise invisible shield. No attacker direction is inferred.
 forceCatch:`float2 v=turn(q,.61);float d=length(v);float an=atan(v.y,v.x+.00001);float g=.72+.21*smoothstep(0.,.38,p);
 float hit=exp(-p*2.3);float span=.19+1.43*smoothstep(0.,.42,p);float mask=1.-smoothstep(.10,span+.15,abs(an));
 float3 blue=float3(.39,.78,1.);float crease=ridge(d-g,.022)+.37*ridge(d-g+.088,.013);
 float4 c=coat(blue,mask*(.35*exp(-sq((d-g)/.16))+.53*crease)*hit);
 c=atop(coat(float3(.90,.97,1.),mask*ridge(d-g,.016)*hit),c);
 for(int i=0;i<7;i++){float j=float(i);float b=(j-3.)*.42;float2 dir=float2(cos(b),sin(b));float2 loc=v-float2(g,0)-dir*(.07+.34*p);
 float along=dot(loc,dir),wide=dot(loc,float2(-dir.y,dir.x));float chip=exp(-abs(along)/.065-abs(wide)/.014);
 c=atop(coat(lit,chip*hit),c);}return c;`,
 forceTrace:`float2 v=turn(q,.61);float an=atan(v.y,v.x+.00001);float catchLight=exp(-t*1.7);float d=r-.96;
 return coat(lit,ridge(d,.012)*(.24*catchLight*exp(-abs(an)*1.6)+.21*exp(-sq((abs(an)-.65)/.17))));`,
 benediction:`float y=q.y-knobs.x*.5,u=1.+y/max(.01,knobs.x);float f=1.-pow(1.-sat(p/knobs.y),3.);
 if(u<-.06||u>1.17)return float4(0);float gate=smoothstep(-.045,.055,u)*(1.-smoothstep(f-.045,f+.02,u));float fall=smoothstep(knobs.y,min(.99,knobs.y+.12),p);
 float4 c=float4(0);for(int i=0;i<3;i++){float j=float(i)-1.;float filament=j*(.42+.13*sin(u*9.-t*4.+j))*(1.-.65*sat(u))+.105*sin(u*12.-t*3.+j*2.);
 float z=q.x-filament;float bright=(.63+.37*cos(11.*u-5.*t+j))*(.64+.3*(1.-abs(j)));
 c=atop(coat(dye,gate*bright*ridge(z,.27)*.54),c);c=atop(coat(lit,gate*bright*ridge(z,.063)),c);}
 return atop(coat(lit,fall*exp(-length(float2(q.x,y*1.35))*4.)*.88),c);`,
};
