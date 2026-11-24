// Run as a separate process: node fx/tests/catalogue.mjs (Node 24+; no npm install).
import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {ABILITIES,paint} from '../abilities.js';import OBR,{live,stats} from './sdk-fixture.mjs';
registerHooks({resolve(s,c,next){return s==='https://esm.sh/@owlbear-rodeo/sdk@3'?{url:new URL('./sdk-fixture.mjs',import.meta.url).href,shortCircuit:true}:next(s,c);}});
let t=0,n=0;const timers=new Map();globalThis.performance={now:()=>t};Date.now=()=>1732000000000+t;
globalThis.setTimeout=(f,ms=0)=>{timers.set(++n,{f,t:t+ms});return n;};globalThis.clearTimeout=id=>timers.delete(id);
async function advance(to){let loops=0;while(timers.size){const [id,e]=[...timers.entries()].sort((a,b)=>a[1].t-b[1].t)[0];if(e.t>to)break;t=e.t;timers.delete(id);await e.f();if(++loops>5000)throw Error('stuck clock');}t=to;}
const engine=await import('../engine.js'),msgs=[];console.warn=(...a)=>msgs.push(a.map(String).join(' '));
const opts={pt:{x:432,y:235},pts:[{x:140,y:180},{x:230,y:110},{x:320,y:240},{x:460,y:250}]};
assert.deepEqual(ABILITIES.filter(a=>a.id.includes('meteor-swarm')).map(a=>a.id),['meteor-swarm-astra']);
let variants=0,auras=0,zones=0;const samples={};
for(const a of ABILITIES){for(const el of a.elements||[undefined]){const preset=paint(a,el);
 for(const alt of [false,...(preset.castSave?[true]:[])]){const form=alt?{...preset,cast:preset.castSave}:preset;const before=stats.plates;stats.peak=0;
  const hits=await engine.play(form,'C',['T'],opts);assert(Object.values(hits).every(Number.isFinite),a.id);await advance(t+21000);
  assert.equal(live.size,0,a.id+' cleanup');assert.equal(timers.size,0,a.id+' timers');if(a.id!=='meteor-swarm-astra')assert(stats.plates>before,a.id+' restored old look');
  if(!alt&&(!el||el===a.elements[0]))samples[a.id]=stats.peak;variants++;}
 if(preset.aura){const r=await engine.startAura(preset.aura,'T',a.id,el);await advance(t+950);assert(live.size>0&&[...live.values()].every(it=>it.attachedTo==='T'));assert([...live.values()].some(it=>it.type==='EFFECT'),a.id);engine.stopAura(r);await advance(t+650);assert.equal(live.size,0);auras++;}
 }if(a.zone){for(const token of ['T',null]){const r=await engine.startZone(a.zone,{x:164,y:210},3,!!token,token);await advance(t+530);assert.equal(live.size,1);assert.equal([...live.values()][0].attachedTo??null,token);engine.stopAura(r);await advance(t+2000);assert.equal(live.size,0);zones++;}}}
await engine.loopMark([{x:30,y:40,r:20}]);await advance(t+1000);assert.equal(live.size,0);assert.equal(await engine.loopFlash([{a:opts.pts[0],b:opts.pts[3],r:20}]),1500);await advance(t+2050);assert(live.size>0);await advance(t+2300);assert.equal(live.size,0);
// Normal + early cancellation, stale in-flight adds, no resumed tasks on the new scene.
await engine.play(ABILITIES.find(a=>a.id==='fireball'),'C',['T'],opts);engine.stopAll();await advance(t+4000);assert.equal(live.size,0);
const add=OBR.scene.local.addItems;let release;await engine.play(ABILITIES.find(a=>a.id==='heal'),'C',['T']);OBR.scene.local.addItems=async ls=>{await new Promise(r=>release=r);await add(ls);};const pending=advance(t+1);await new Promise(r=>setImmediate(r));assert(release);engine.stopAll();release();await pending;await advance(t+6000);assert.equal(live.size,0);OBR.scene.local.addItems=add;
const {loadBar}=await import('../barctl.js');globalThis.localStorage={getItem:()=>JSON.stringify({open:true,slots:[{a:'missing-vfx'},{a:'heal'},{a:'heal'},{a:'meteor-swarm-astra'}]})};assert.deepEqual(loadBar().slots.map(s=>s.a),['heal','meteor-swarm-astra']);assert.equal(timers.size,0);
assert.deepEqual(msgs,[]);console.log(JSON.stringify({abilities:ABILITIES.length,castVariants:variants,auraVariants:auras,zonePaths:zones,examplePeaks:Object.fromEntries(['fireball','firebolt','heal','lightning-bolt','bless','sacred-flame','meteor-swarm-astra'].map(id=>[id,samples[id]]))},null,2));
