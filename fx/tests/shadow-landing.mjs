// Node 24+, run from any folder. Exercise the real background -> cast -> room -> aura pipeline.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import OBR,{live} from './sdk-fixture.mjs';
import {STATE,SEL} from '../const.js';
const fakeAim = 'data:text/javascript,' + encodeURIComponent('export const startAim=x=>{globalThis.testAim=x},startPick=()=>{},cancelAim=()=>{},aiming=()=>false,feetPerCell=async()=>5;');
registerHooks({resolve(s,c,next){if(s==='https://esm.sh/@owlbear-rodeo/sdk@3')return {url:new URL('./sdk-fixture.mjs',import.meta.url).href,shortCircuit:true};if(s==='./aim.js')return {url:fakeAim,shortCircuit:true};return next(s,c);}});
let t=0,n=0;const timers=new Map(),flush=()=>new Promise(ok=>setImmediate(ok));globalThis.performance={now:()=>t};Date.now=()=>1732000000000+t;
globalThis.setTimeout=(f,ms=0)=>{timers.set(++n,{f,at:t+ms});return n;};globalThis.clearTimeout=id=>timers.delete(id);
async function advance(to){await flush();while(timers.size){const [id,e]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(e.at>to)break;t=e.at;timers.delete(id);e.f();await flush();}t=to;await flush();}
const token={id:'C',type:'IMAGE',name:'Шадар-кай',position:{x:-80,y:30},scale:{x:1.5,y:0.8},layer:'CHARACTER',lastModified:new Date(Date.now()).toISOString()};
// Deliberately use an image alignment different from its center; scaling changes its bounding center.
function bounds(){const {position:p,scale:s}=token;return {center:{x:p.x+34*s.x,y:p.y+21*s.y},width:100*Math.abs(s.x),height:148*Math.abs(s.y)};}
let role='GM',recv,metaCb,itemCb,boot,metadata={},addedByPlayer=null;const publications=[];
globalThis.window={addEventListener(){}};globalThis.localStorage={getItem:key=>key===SEL?JSON.stringify({c:{id:'C',name:token.name}}):null};
OBR.onReady=f=>boot=f();OBR.scene.isReady=async()=>true;OBR.scene.onReadyChange=()=>{};
OBR.player={getRole:async()=>role,onChange:()=>{},getConnectionId:async()=>'self'};OBR.party={getPlayers:async()=>[],onChange:()=>{}};OBR.contextMenu={create:async()=>{}};OBR.notification={show:async()=>{}};
OBR.broadcast={onMessage:(ch,f)=>recv=f,sendMessage:async(ch,m)=>{if(m.op==='add')addedByPlayer=m.list;}};
OBR.room={getMetadata:async()=>structuredClone(metadata),onMetadataChange:f=>metaCb=f,setMetadata:async m=>{Object.assign(metadata,structuredClone(m));if(m[STATE]?.e.length)publications.push({at:t,scale:{...token.scale}});metaCb(structuredClone(metadata));}};
OBR.scene.grid.snapPosition=async p=>p;OBR.scene.items={getItems:async()=>[structuredClone(token)],getItemBounds:async()=>bounds(),onChange:f=>itemCb=f,updateItems:async(ids,fn)=>{fn([token]);token.lastModified=new Date(Date.now()).toISOString();itemCb([structuredClone(token)]);}};
const A={id:'shadow-step',pt:{x:385,y:-173}};const aura=()=>[...live.values()].filter(x=>x.attachedTo==='C');
const assertCentered=async()=>{const items=aura();assert.equal(items.length,3);for(const it of items){const bb=await OBR.scene.local.getItemBounds([it.id]);assert(Math.abs(bb.center.x-bounds().center.x)<.0001&&Math.abs(bb.center.y-bounds().center.y)<.0001);}const ring=items.find(it=>it.name==='Астра · ring');assert.equal(ring.uniforms.find(u=>u.name==='unit').value,Math.max(bounds().width,bounds().height)*.5*1.08);};
await import('../background.js');await boot;await flush();
await recv({data:{op:'cast',a:A.id,dur:{mode:'x'}}});await flush();const apply=testAim.onFire({pt:A.pt,targets:[]});
await advance(800);assert.notEqual(token.scale.x,1.5);assert.equal(aura().length,0);assert.equal(publications.length,0,'must not publish while teleport is animating');
await advance(1800);await apply;assert.equal(publications.length,1);assert.deepEqual(publications[0].scale,{x:1.5,y:0.8});assert.deepEqual(bounds().center,A.pt);await assertCentered();
const final=structuredClone(token),entry=structuredClone(metadata[STATE].e[0]);assert.equal(entry.shadowLanded,final.lastModified);
// Simulate a client whose room metadata arrived before the last position/scale packet.
metadata={[STATE]:{e:[],p:null}};metaCb(metadata);await flush();assert.equal(aura().length,0);
token.scale={x:.075,y:.04};token.lastModified=new Date(Date.parse(final.lastModified)-100).toISOString();metadata[STATE].e=[entry];metaCb(metadata);await flush();assert.equal(aura().length,0);
Object.assign(token,final);itemCb([token]);await advance(t+550);await assertCentered();
// A later rejoin, after a manual move: use current bounds, not the old destination.
metadata[STATE].e=[];metaCb(metadata);await flush();token.position={x:700,y:500};token.lastModified=new Date(Date.now()).toISOString();metadata[STATE].e=[entry];metaCb(metadata);await flush();await assertCentered();
console.log('Shadow Step: scale restored before publication; late scene update, offset image center, nonuniform scale, later position and all three aura layers OK');
