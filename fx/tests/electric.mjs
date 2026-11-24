import assert from 'node:assert/strict';
import {finish} from '../astra/grimoire/finish.js';
import {plate} from '../astra/grimoire/plates.js';
import {ABILITIES,paint} from '../abilities.js';
import {brushes} from '../astra/grimoire/brush.js';
import {buildEffect} from './sdk-fixture.mjs';
const all=Object.fromEntries(ABILITIES.map(a=>[a.id,a]));
const sparks=['bolt','cone','shock','burst','comet','wisps'];
assert.equal(finish('lightning-bolt'),'electric');
for(const id of ['sorcerous-burst','dragons-breath','dragons-breath-buff'])assert.equal(finish(id,paint(all[id],'lightning').visualElement),'electric');
assert.equal(finish('sorcerous-burst','thunder'),'echo');assert.equal(finish('rolen-seam'),'storm');
for(const kind of sparks){const ordinary=plate(kind,'echo'),electric=plate(kind,'electric');assert.notEqual(ordinary,electric);assert.equal(plate(kind,'echo'),ordinary);assert.equal(plate(kind,'electric'),electric);assert(!plate(kind,'fire').includes('float4 forked('));}
const A={x:24,y:24,r:32},B={x:420,y:165};let item;
const b=brushes({buildEffect,dpi:()=>64,anchor:()=>({x:0,y:0}),spawn:(_,items)=>{[item]=items;}});
const spell=paint(all['dragons-breath'],'lightning');const cone=spell.cast.find(s=>s.fx==='cone');
assert.equal(b.cast.cone(A,B,{...cone,finish:'electric'},0),cone.duration*.3);
assert.equal(item.uniforms.find(u=>u.name==='knobs').value.y,6);
for(const st of all['lightning-bolt'].cast.filter(st=>st.fx==='bolt'))assert.equal(b.cast.bolt(A,B,{...st,finish:'electric'},0),st.duration*st.grow);
console.log('Electric routing, cache separation, breath forks and hit times OK');
