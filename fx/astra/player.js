import { score, valid } from './score.js';
import { materials } from './materials.js';

// One owner of at most ten local items. No shared items, texture URLs, intervals or listeners.
// Backpressure: never queue a second update while the previous SDK call is in flight.
export function makeAstra(obr,buildEffect,clock=performance,timeout=setTimeout,untimer=clearTimeout){
 let generation=0,current=null;
 const remove=async ids=>{
  for(let attempt=0;attempt<2;attempt++)try{await obr.scene.local.deleteItems(ids);return;}
  catch(e){if(attempt)console.warn('[Астра] очистка локальной сцены',e);}
 };
 function cancel(job){
  if(!job||job.dead)return;job.dead=true;untimer(job.timer);
  globalThis.removeEventListener?.('pagehide',job.onHide);
  if(job.added)void remove(job.ids);if(current===job)current=null;
 }
 async function run(points,targets,dpi,feet,options,epoch){
  if(epoch!==generation||!points.some(valid))return {};
  cancel(current);const job={dead:false,timer:0,added:false,ids:[]};current=job;
  job.onHide=()=>cancel(job);globalThis.addEventListener?.('pagehide',job.onHide,{once:true});
  try{
   const vp=obr.viewport;
   const [w,h,scale]=await Promise.all([vp.getWidth(),vp.getHeight(),obr.scene.grid.getScale()]);
   const [a,b]=await Promise.all([vp.inverseTransformPoint({x:0,y:0}),vp.inverseTransformPoint({x:w,y:h})]);
   if(job.dead)return {};
   const R=dpi*feet/Math.max(.01,Number(scale?.parsed?.multiplier)||5);
   const sc=score(points,R,{x:a.x,y:a.y,w:Math.max(1,b.x-a.x),h:Math.max(1,b.y-a.y)});
   const quality=options.quality??1, mat=materials(quality), z=Date.now();
   const rows=sc.slots.map((s,i)=>{
    // Initialize all declared uniforms even for tracks which are not visible yet.
    const init=sc.sample(s,s.kind==='comet'?sc.tracks[s.i].emerge+.001:s.kind==='impact'?sc.tracks[s.i].hit:0);
    const box=init.box, uniformList=u=>Object.entries(u).map(([name,value])=>({name,value}));
    const it=buildEffect().effectType(box?'STANDALONE':'VIEWPORT').sksl(mat[s.kind])
     .width(box?.w||1).height(box?.h||1).position({x:box?.x||0,y:box?.y||0})
     .uniforms(uniformList(init.u)).layer(box?'ATTACHMENT':'POST_PROCESS').name('Метеоритный дождь · Астра')
     .locked(true).disableHit(true).visible(false).zIndex(z+i).build();
    it.disableAutoZIndex=true;
    return {s,it,uniformList};
   });
   job.ids=rows.map(r=>r.it.id);
   try{await obr.scene.local.addItems(rows.map(r=>r.it));}catch(e){await remove(job.ids);throw e;}
   job.added=true;
   if(job.dead){await remove(job.ids);return {};}
   // Calibrate the standalone anchor from native bounds once, not on every frame.
   // This also handles a renderer that centers its effect rect instead of using its corner.
   let ax=0,ay=0;
   try{const gate=rows[1].it,bounds=await obr.scene.local.getItemBounds([gate.id]);
    if(bounds.width>0&&bounds.height>0){ax=(gate.position.x-bounds.center.x)/gate.width+.5;ay=(gate.position.y-bounds.center.y)/gate.height+.5;}
   }catch{/* Top-left local coordinates are the default. */}
   if(job.dead)return {};
   const t0=clock.now(), wait=Math.max(0,options.delay||0), budget=1000/(quality<.8?30:40);
   async function step(){
    if(job.dead)return;const start=clock.now(),t=(start-t0-wait)/1000;
    if(t>=sc.duration){cancel(job);return;}
    const active=[],patch=new Map();
    for(const r of rows){const frame=sc.sample(r.s,t);if(!frame&&!r.it.visible)continue;
     const q=frame?{visible:true,uniforms:r.uniformList(frame.u)}:{visible:false};
     if(frame?.box){const b=frame.box;q.position={x:b.x+ax*b.w,y:b.y+ay*b.h};q.width=b.w;q.height=b.h;}
     active.push(r.it);patch.set(r.it.id,q);
    }
    try{if(active.length){
     // Passing snapshots instead of ids avoids re-fetching shader source at frame rate.
     await obr.scene.local.updateItems(active,ds=>{for(const d of ds)Object.assign(d,patch.get(d.id));});
     for(const r of rows)if(patch.has(r.it.id))r.it={...r.it,...patch.get(r.it.id)};
    }}catch(e){console.warn('[Астра] кадр',e);cancel(job);return;}
    if(!job.dead)job.timer=timeout(step,Math.max(4,budget-(clock.now()-start)));
   }
   void step();const hits={'@pt':wait+sc.tracks[0].hit*1000};
   for(const tok of targets){const tr=sc.tracks.find(m=>Math.hypot(m.dst.x-tok.x,m.dst.y-tok.y)<=R+.5*(tok.r||0));if(tr)hits[tok.id]=wait+tr.hit*1000;}
   return hits;
  }catch(e){cancel(job);console.warn('[Астра] запуск',e);return {};}
 }
 return {run,epoch:()=>generation,stop(){generation++;cancel(current);}};
}
