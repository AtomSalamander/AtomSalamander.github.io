import { colors } from './finish.js';
import { plate } from './plates.js';
const sat=x=>Math.min(1,Math.max(0,x)), smooth=x=>{x=sat(x);return x*x*(3-2*x);};
const two=(x,y)=>({x,y}),three=(x,y,z)=>({x,y,z});
const deg=Math.PI/180;
const defs={burst:[1,700],area:[3,1400],implode:[1.1,800],shock:[1.5,700],debris:[1.5,1100],smoke:[1,2200],sigil:[1,1800],spiral:[1.3,1300]};
// The effect rectangle and its center use world pixels. A standalone attached to a token is
// moved by Owlbear; JS only animates uniforms, never overwrites the token-relative placement.
export function brushes({buildEffect,spawn,dpi,anchor}){
 function position(c,w,h){const a=anchor();return two(c.x+(a.x-.5)*w,c.y+(a.y-.5)*h);}
 function item(kind,c,unit,w,h,o={},knobs=[0,0,0],axis=two(1,0)){
  const uniforms={phase:three(0,0,0),unit,...colors(o),knobs:three(...knobs),axis,seed:Math.abs(Math.sin(c.x*.041+c.y*.017)*47.31)};
  const it=buildEffect().effectType('STANDALONE').width(w).height(h).position(position(c,w,h)).sksl(plate(kind,o.finish)).uniforms(Object.entries(uniforms).map(([name,value])=>({name,value}))).build();
  Object.assign(it,{name:'Астра · '+kind,layer:o.layer||'ATTACHMENT',zIndex:o.z??Date.now()+10,locked:true,disableHit:true,disableAutoZIndex:true});
  if(o.attach){it.attachedTo=o.attach;it.disableAttachmentBehavior=['SCALE','ROTATION','LOCKED'];}return it;
 }
 function emit(it,dur,delay,frame){spawn(delay,[it],{dur,f:(p,P)=>{const q=frame(p,p*dur/1000);P.set(it.id,q);}});}
 const phase=(p,t,f)=>({phase:three(p,t,sat(f))});
 const envelope=p=>smooth(p/.09)*smooth((1-p)/.31);
 function radial(kind,c,o,d){const D=dpi(),[rad,dur0]=defs[kind],R=(o.radius||rad)*D,nd=o.duration||dur0;
  const n=Math.min(4,o.rings||2),gap=o.gap??.18,dur=kind==='shock'?nd*(1+gap*(n-1)):nd;
  let pad=1.37,b=[0,0,0],gain=o.opacity??1,center=c;
  switch(kind){case 'shock':b=[n,gap,(o.width||.05)*D/R];break;
   case 'burst':b=[Math.min(24,o.sparks??10),o.flash??1,0];break;
   case 'area':b=[o.opacity??.30,0,0];gain=1;break;
   case 'debris':b=[Math.min(40,o.count||12),o.height??1,Math.min(.23,(o.size||.09)*D/R)];pad=1.94;break;
   case 'smoke':b=[(o.rise??.5)*D/R,o.opacity??.45,0];pad=1.55+.53*b[0];gain=1;break;
   case 'sigil':b=[o.points||5,o.runes??8,(o.spin??60)*deg];break;
   case 'spiral':b=[o.turns||2.5,(o.spin??540)*deg/(dur/1000),0];break;}
  const it=item(kind,center,R,2*R*pad,2*R*pad,kind==='sigil'?{layer:'MOUNT',...o}:o,b);
  emit(it,dur,d,(p,t)=>phase(p,t,envelope(p)*gain));return 0;
 }
 const cast=Object.fromEntries(Object.keys(defs).map(k=>[k,(c,o,d)=>radial(k,c,o,d)]));
 for(const kind of ['rise','embers'])cast[kind]=(c,o,d)=>{
  const D=dpi(),R=Math.max(.28*D,(o.spread!=null?o.spread*D:(c.r||D*.5))*(kind==='rise'?.95:1.05)),H=(o.height||(kind==='rise'?1.4:1))*D;
  const it=item('drift',two(c.x,c.y-H*.48),R,2.4*R,H*1.38+.33*R,o,[Math.min(12,o.count||10),H/R,o.glyph==='+'?1:0]);
  emit(it,o.duration||(kind==='rise'?1400:1600),d,(p,t)=>phase(p,t,envelope(p)));return 0;
 };
 function pathItem(kind,A,B,R,o,b,pad){const dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy)||.001,axis=two(dx/L,dy/L);return item(kind,two((A.x+B.x)/2,(A.y+B.y)/2),R,Math.abs(dx)+2*pad,Math.abs(dy)+2*pad,o,b,axis);}
 for(const kind of ['beam','bolt'])cast[kind]=(A,B,o,d)=>{const D=dpi(),R=D*(o.width||(kind==='bolt'?.06:.12)),L=Math.hypot(B.x-A.x,B.y-A.y),amp=(o.jag??(kind==='beam'?.035:.32))*D/R,g=o.grow??(o.wave?.25:.08),dur=o.duration||(kind==='beam'?650:450);
  const it=pathItem(o.wave?'tether':kind,A,B,R,o,[L/R,amp,g],R*((o.finish==='electric'?2.6:1)*amp+4));emit(it,dur,d,(p,t)=>phase(p,t,envelope(p)));return o.hitAt??(kind==='beam'?120:g*dur);
 };
 cast.seam=(A,B,o,d)=>{
  const D=dpi(),R=(o.veinLen??.60)*D,L=Math.hypot(B.x-A.x,B.y-A.y),dur=o.duration||3200,grow=o.grow||320;
  const it=pathItem('fault',A,B,R,o,[L/R,Math.min(12,Math.max(3,L/D*(o.veins??1.6)))*R/Math.max(1,L),o.pulse??1.1],R*1.4);
  emit(it,dur,d,(p,t)=>phase(smooth(p*dur/grow),t,smooth(p*dur/75)*smooth((1-p)*dur/Math.min(1000,.35*dur))));return o.hitAt??grow;
 };
 cast.cone=(A,B,o,d)=>{const D=dpi(),L=(o.length||3)*D,ang=Math.atan2(B.y-A.y,B.x-A.x),v=two(Math.cos(ang),Math.sin(ang)),s=(A.r||D*.5)*.6,c=two(A.x+(s+.5*L)*v.x,A.y+(s+.5*L)*v.y),w=Math.tan((o.angle??53)*deg*.5),dur=o.duration||1600;
  const it=item('cone',c,L,L*(Math.abs(v.x)+2.2*w*Math.abs(v.y)+.16),L*(Math.abs(v.y)+2.2*w*Math.abs(v.x)+.16),o,[w,o.bolts??4,0],v);emit(it,dur,d,(p,t)=>phase(p,t,envelope(p)));return o.hitAt??dur*.3;
 };
 cast.pillar=(c,o,d)=>{const D=dpi(),W=(o.width||.4)*D,H=(o.height||3.5)*D,fall=o.fall||260,dur=o.duration||1600;
  const x=c.x+(o.miss?(Math.random()<.5?-1:1)*((c.r||D/2)+D*(o.side??.45)):0);const it=item('pillar',two(x,c.y-H*.5),W,6.8*W,H+3.3*W,o,[H/W,Math.min(.97,fall/dur),o.flames?1:0]);
  emit(it,dur,d,(p,t)=>phase(p,t,smooth(p/.055)*smooth((1-p)/(1-(o.hold??.60)))*(o.opacity??1)));return o.hitAt??fall;
 };
 function zoneItem(c,R,o){return item('domain',c,R,2.35*R,2.35*R,{...o,color:o.color||'#120c21',core:o.ripple||o.glow||'#9678c6',dark:o.color||'#070610'},[o.ripples?1:0,0,0]);}
 cast.gloom=(c,o,d)=>{const enter=o.grow||900,exit=o.fade||1500,dur=enter+(o.hold??5000)+exit;const it=zoneItem(c,(o.radius||3)*dpi(),o);emit(it,dur,d,(p,t)=>phase(.03+.97*smooth(p*dur/enter),t,smooth(p*dur/enter)*smooth((1-p)*dur/exit)*(o.opacity??1)));return 0;};
 function aura(p,c,tok,z){const D=dpi(),T=c.r||D/2;let kind=p.fx,R=T*(p.size||1.12),pos=c,b=[0,0,0],v=two(1,0),layer=p.layer,op=p.opacity??1,ratio=1.31;
  switch(kind){case 'arcs':R=T*(p.radius||1.1);b=[Math.max(3,p.count||5),p.width||.03,p.rate||1];break;
   case 'plates':kind='mineral';R=T*((p.radius||.95)+.5*(p.width||.2));b=[p.count||8,T*(p.width||.2)/(2*R),(p.spin??4)*deg];ratio=1.56;break;
   case 'dome':b=[p.cells||3.4,p.fill??.13,0];break;
   case 'glow':layer=layer||'MOUNT';op=p.opacity??.30;break;
   case 'ring':b=[Math.max(.012,(p.width||.05)*D/R),p.dash?1:0,(p.spin??12)*deg];break;
   case 'sigil':layer=layer||'MOUNT';b=[p.points||5,p.runes??8,(p.spin??15)*deg];break;
   case 'wisps':R=T*((p.radius||.8)+(p.size||.35)*.6);op=p.opacity??.4;break;
   case 'orbit':case 'stars':{const stars=kind==='stars';kind='orbit';R=T*(p.radius||(stars?.6:1.1));pos=two(c.x,c.y-(stars?T*(p.height??.85):0));b=[p.count||3,stars?p.tilt??.35:1,D*(p.size||.07)/R];v=two((p.speed??90)*deg,0);break;}
   default:return null;
  }
  const it=item(kind,pos,R,2*ratio*R,2*ratio*R,{...p,z,layer,attach:tok},b,v);return {it,f:(t,P)=>{const age=Math.max(0,t-(p.delay||0));P.set(it.id,phase(1,age,op*smooth(age/.49)*(.94+.06*Math.sin(age*2.1))));}};
 }
 // Tail in a moving tangent frame. Weapon silhouettes stay vector-sharp at every zoom.
 function flight(A,B,o,d,shapes){const D=dpi(),dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy)||1,dur=Math.max(180,L/D/(o.speed||14)*1000),arc=(o.arc||0)*D,nx=-dy/L,ny=dx/L;
  const R=D*(o.size||.3)/2,tail=Math.min(12,Math.max(2.6,(o.trail??6)*.82+(o.ribbons?.length||0))),side=2*R*(tail+1.3),stick=o.stick||0,total=dur+Math.max(stick,170);
  const at=k=>two(A.x+dx*k+nx*Math.sin(k*Math.PI)*arc,A.y+dy*k+ny*Math.sin(k*Math.PI)*arc);
  const it=item('comet',A,R,side,side,o,[tail,o.ribbons?.length ? .9 : .25,o.shape ? .18 : 1]);const polys=shapes||[];
  spawn(d,[it,...polys.map(x=>x.it)],{dur:total,f:(p,P)=>{const ms=p*total,k=sat(ms/dur),c=at(k),h=Math.cos(k*Math.PI)*Math.PI*arc,ux=dx+nx*h,uy=dy+ny*h,n=Math.hypot(ux,uy)||1;
   const end=Math.max(0,ms-dur);P.set(it.id,{...phase(k,ms/1000,smooth(ms/45)*smooth(1-end/170)*(o.shape==='arrow'?.48:1)),pos:position(c,side,side),axis:two(ux/n,uy/n)});
   const rot=Math.atan2(uy,ux)/deg+(end&&stick?Math.sin(end*.05)*5*Math.exp(-end/140):0),alpha=end?(stick?smooth((stick-end)/230):0):smooth(ms/45);
   for(const q of polys)P.set(q.it.id,{x:c.x,y:c.y,r:rot,fo:q.fo*alpha,so:q.so*alpha});
  }});return dur;
 }
 return {cast,item,phase,emit,zoneItem,aura,flight,pathItem};
}
