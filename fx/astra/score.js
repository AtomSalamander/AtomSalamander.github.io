// Астра · choreography. Distances here are scene pixels, time is cast-local seconds.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sat=x=>clamp(x,0,1);
const ease=x=>{x=sat(x);return x*x*(3-2*x);};
const pt=(x,y)=>({x,y});
const sub=(a,b)=>pt(a.x-b.x,a.y-b.y);
const mix=(a,b,k)=>pt(a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k);
export const HITS=[4.64,5.23,5.94,6.68];
export const LENGTH=HITS[3]+5.1;
export const valid=p=>p && Number.isFinite(p.x)&&Number.isFinite(p.y);
const rect=(x,y,w,h)=>({x,y,w,h});

export function score(input,R,view){
 const pts=input.filter(valid).slice(0,4).map(p=>pt(p.x,p.y));if(!pts.length)return null;
 const original=pts.length; // Old single-point broadcasts: deterministic across viewers.
 while(pts.length<4){const i=pts.length,b=pts[(i-original)%original],a=i*2.39996;pts.push(pt(b.x+R*1.15*Math.cos(a),b.y+R*1.15*Math.sin(a)));}
 const {x,y,w,h}=view,S=Math.min(w,h),gw=Math.min(w*.88,h*1.73),cx=x+w*.5,cy=y+h*.19;
 const gr=rect(cx-gw/2,cy-gw/4,gw,gw/2);
 const order=[0,1,2,3].sort((a,b)=>pts[a].x-pts[b].x||a-b);
 const tracks=pts.map((dst,i)=>{
  const lane=order.indexOf(i),u=(lane-1.5)*.19;const seed=[2.7,9.8,15.3,23.1][i];
  const start=pt(cx+gw*u,cy-gw*.074*u),r=S*[.036,.041,.033,.044][i];
  const emerge=.82+.24*i,release=HITS[i]-[1.26,1.1,1.42,1.5][i];
  const hover=pt(start.x+(lane-1.5)*r*.46,start.y+r*(3.28+.31*(i%2)));
  const vertical=dst.y-hover.y;const ctrl=pt(hover.x+(dst.x-hover.x)*.18+S*[-.09,.07,-.13,.09][i],Math.min(hover.y+vertical*.26-.085*S,dst.y-.25*S));
  function path(t){
   if(t>=HITS[i])return dst;
   const born=ease((t-emerge)/.94),flight=sat((t-release)/(HITS[i]-release)),k=.08*flight+.92*flight*flight;
   const src=mix(start,hover,born);const hoverWave=(1-k)*born;
   src.x+=Math.sin(2.9*t+seed)*r*.12*hoverWave;src.y+=Math.sin(2.21*t+seed)*r*.16*hoverWave;
   return mix(mix(src,ctrl,k),mix(ctrl,dst,k),k);
  }
  const blast=Math.min(R*.78,S*[.18,.163,.205,.195][i]);
  return {dst,r,seed,emerge,release,hit:HITS[i],blast,path};
 });
 const slots=[{kind:'grade'},{kind:'gate'},...tracks.map((_,i)=>({kind:'impact',i})),...tracks.map((_,i)=>({kind:'comet',i}))];
 function sample(s,t){
  if(t<0||t>=LENGTH)return null;
  if(s.kind==='grade'){
   if(t>10.2)return null;
   const flash=Math.min(1,HITS.reduce((n,h)=>n+(t<h?0:Math.exp(-(t-h)*8)*ease((t-h)/.035)),0));
   return {box:null,u:{age:t,exposure:flash,gate:{x:cx,y:cy,z:gw}}};
  }
  if(s.kind==='gate')return t<5.65?{box:gr,u:{age:t,seed:7.25}}:null;
  const tr=tracks[s.i],{seed,hit,dst}=tr,dt=t-hit;
  if(s.kind==='impact'){
   if(dt< -2.2||dt>5.05)return null;
   const b=tr.blast; const d=dt<0?b*1.63:Math.max(dt<1.58?R*Math.min(1.19,1.25-Math.exp(-3.15*dt)):0,b*(dt<2.05?4.12:2.85));
   return {box:rect(dst.x-d,dst.y-d,2*d,2*d),u:{origin:pt(d,d),unit:b,radius:R,age:dt,seed,form:s.i}};
  }
  if(t<=tr.emerge||dt>.91)return null;
  const birth=ease((t-tr.emerge)/.85),run=ease((t-tr.release)/.61),unit=tr.r*(.12+.88*birth)*(1+.22*run);
  const head=tr.path(Math.min(t,hit)),span=.57+.34*run;
  const dir=sub(tr.path(Math.min(hit,t+.012)),tr.path(Math.min(hit,t)-.045));
  const k=ease((t-tr.release)/.45);dir.x=k*dir.x+(1-k)*unit*.028;dir.y=k*dir.y+(1-k)*unit*.17;
  const speed=Math.hypot(dir.x,dir.y)||1,axis=pt(dir.x/speed,dir.y/speed);
  function wakePos(f){const q=tr.path(Math.min(hit,t-f*span));const residual=(1-k)*unit*2.1*f;return pt(q.x-residual*axis.x,q.y-residual*axis.y);}
  const old=wakePos(1),mid=wakePos(.5),pad=unit*4.6;
  const left=Math.min(head.x,old.x,mid.x)-pad,top=Math.min(head.y,old.y,mid.y)-pad;
  const box=rect(left,top,Math.max(head.x,old.x,mid.x)+pad-left,Math.max(head.y,old.y,mid.y)+pad-top);
  const local=p=>pt(p.x-left,p.y-top);
  return {box,u:{head:local(head),old:local(old),mid:local(mid),unit,axis,seed,age:t,
   strength:(.74+.25*run)*(1-ease(dt/.31)),wake:birth*(1-ease(dt/.91)),body:birth*(1-ease(dt/.075))}};
 }
 return {slots,sample,tracks,duration:LENGTH};
}
