import OBR,{buildEffect} from 'https://esm.sh/@owlbear-rodeo/sdk@3';
import {spawn,c01,DPI} from './engine.js';
import {surface} from './astra-materials.js';
const pt=(x,y)=>({x,y}),tri=(x,y,z)=>({x,y,z}),smooth=x=>{x=c01(x);return x*x*(3-2*x);};
const rgb=h=>{const v=parseInt(h.slice(1),16);return tri((v>>16&255)/255,(v>>8&255)/255,(v&255)/255);};
let anchor=pt(0,0),serial=0;
export async function calibratePlates(){const it=buildEffect().effectType('STANDALONE').width(32).height(32).position(pt(0,0)).visible(false).name('⚡ emergence').sksl('half4 main(float2 p){return half4(0); }').build();
 try{await OBR.scene.local.addItems([it]);const b=await OBR.scene.local.getItemBounds([it.id]);if(b.width>0&&b.height>0&&Number.isFinite(b.center.x+b.center.y))anchor=pt(.5-b.center.x/32,.5-b.center.y/32);}catch{/* default top-left */}finally{try{await OBR.scene.local.deleteItems([it.id]);}catch{}}}
const pos=(c,w,h)=>pt(c.x+(anchor.x-.5)*w,c.y+(anchor.y-.5)*h);
const list=o=>Object.entries(o).map(([name,value])=>({name,value}));
function make(kind,c,R,w,h,o){const uniforms={unit:R,axis:o.axis||pt(1,0),dye:rgb(o.col||'#00d4ff'),opt:tri(...(o.opt||[0,0,0])),phase:tri(0,0,0),seed:Math.abs(Math.sin(c.x*.037+c.y*.013+(serial++%71)*.8)*53.1)};
 const it=buildEffect().effectType('STANDALONE').width(w).height(h).position(pos(c,w,h)).sksl(surface(kind)).uniforms(list(uniforms)).name('⚡ emergence').layer(o.layer||'ATTACHMENT').locked(true).disableHit(true).zIndex(o.z??1000100).build();it.disableAutoZIndex=true;return it;}
const envelope=p=>smooth(p/.08)*smooth((1-p)/.25);
export function film(kind,c,R,dur,delay=0,o={}){R=Math.max(.1,R);const w=o.w||R*(o.pad||2.65),h=o.h||R*(o.pad||2.65);const it=make(kind,c,R,w,h,o);
 return spawn(delay,[it],{dur,f:(p,P)=>{const time=p*dur/1000;const follow=o.follow?.();P.set(it.id,{...(follow?pos(follow,w,h):{}),phase:tri(p,time,c01((o.gain?o.gain(p,time):envelope(p))*(o.alpha??1)))});}});}
export function rail(kind,A,B,R,dur,delay=0,o={}){const dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy);if(L<.001)return;const pad=o.margin??R*1.4;
 return film(kind,pt((A.x+B.x)/2,(A.y+B.y)/2),R,dur,delay,{...o,axis:pt(dx/L,dy/L),w:Math.abs(dx)+2*pad,h:Math.abs(dy)+2*pad,opt:o.vec?o.vec(L/R):[L/R,0,0]});}
export function marker(kind,follow,options={}){const initial=follow(),R=Math.max(.1,initial?.r||DPI*.5),side=2.65*R;const it=make(kind,initial||pt(0,0),R,side,side,options);
 return spawn(0,[it],{loop:true,every:65,appear:620,fade:550,f:(t,P,a)=>{const T=follow();if(!T){P.set(it.id,{phase:tri(1,t,0)});return;}const r=Math.max(.1,T.r),l=2.65*r,c=pos(T,l,l);
 P.set(it.id,{x:c.x,y:c.y,box:[l,l,r],phase:tri(1,t,a.v*(options.alpha??1))});}});}
export function wallField(A,B,K,col){const D=DPI,dx=B.x-A.x,dy=B.y-A.y,L=Math.max(.001,Math.hypot(dx,dy)),u=K?c01(((K.x-A.x)*dx+(K.y-A.y)*dy)/(L*L)):.5;
 const it=make('wall',pt((A.x+B.x)/2,(A.y+B.y)/2),D,Math.abs(dx)+D,Math.abs(dy)+D,{axis:pt(dx/L,dy/L),opt:[L/D,u,0],col,layer:'DRAWING'});
 return spawn(0,[it],{loop:true,every:65,appear:600,fade:650,f:(t,P,a)=>P.set(it.id,{phase:tri(1,t,a.v)})});}

// A single post-process plate for this cast; the same queue owns and deletes it.
export function pullScene(target,r,dur,shader,follow){const it=buildEffect().effectType('VIEWPORT').width(1).height(1).position(pt(0,0)).sksl(shader).uniforms(list({focus:tri(target.x,target.y,r),phase:tri(0,0,0)})).layer('POST_PROCESS').locked(true).disableHit(true).name('⚡ emergence').zIndex(1000108).build();
 return spawn(0,[it],{dur,f:(p,P)=>{const T=follow?.()||target;P.set(it.id,{phase:tri(p,p*dur/1000,1),focus:tri(T.x,T.y,r)});}});}
