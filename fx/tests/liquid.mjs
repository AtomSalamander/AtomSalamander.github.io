import assert from 'node:assert/strict';
import { ABILITIES, paint } from '../abilities.js';
import { plate } from '../astra/grimoire/plates.js';
const spell=(id,el)=>paint(ABILITIES.find(a=>a.id===id),el);
const burst=steps=>steps.filter(s=>s.fx==='burst');
for(const a of [spell('firebolt'),spell('sorcerous-burst','acid'),spell('sorcerous-burst','poison')]){
 for(const [steps,where] of [[a.cast,'targets'],[a.castSave,'miss']]){
  const bursts=burst(steps);assert(bursts.some(s=>s.at===where));
  for(const s of bursts)assert.deepEqual([s.sparks,s.flash],[0,0],`${a.id}/${s.at}`);
 }
}
for(const el of ['fire','cold','lightning','thunder','psychic']){
 const a=spell('sorcerous-burst',el);for(const steps of [a.cast,a.castSave])assert(burst(steps).every(s=>s.sparks>0));
}
// Particle accents wrap the standard paint, rather than replacing the whole shape.
for(const kind of ['cone','comet','wisps']){
 const ordinary=plate(kind,'venom'),acid=plate(kind,'acid');assert.notEqual(acid,ordinary);
 assert(acid.includes('atop(drops(q,phase.x,phase.y),paint(q,phase.x,phase.y))'));
 const body=s=>s.slice(s.indexOf('float4 paint(')).split('\nfloat4 bead(')[0].split('\nhalf4 main(')[0];
 assert.equal(body(acid).trim(),body(ordinary).trim(),kind+' keeps magic silhouette');
 assert(!ordinary.includes('float4 bead('));assert.equal(plate(kind,'venom'),ordinary);
}
for(const kind of ['shock','sigil','smoke','glow'])assert.equal(plate(kind,'acid'),plate(kind,'venom'));
const a=spell('sorcerous-burst','acid');for(const [steps,where] of [[a.cast,'targets'],[a.castSave,'miss']]){
 const spray=steps.filter(s=>s.fx==='acidSpray');assert.equal(spray.length,1);assert.equal(spray[0].at,where);assert.equal(spray[0].after,'hit');
 assert(steps.some(s=>s.fx==='shock'&&!s.layer));
}
assert(a.cast.some(s=>s.fx==='smoke'));assert(!spell('sorcerous-burst','poison').cast.some(s=>s.fx==='acidSpray'));
const breath=spell('dragons-breath','acid');assert(breath.cast.some(s=>s.fx==='smoke'&&s.at==='point'));
assert(breath.cast.some(s=>s.fx==='acidSpray'&&s.at==='targets'));
assert(spell('dragons-breath-buff','acid').cast.some(s=>s.fx==='sigil'));
const spear=spell('chromatic-spear').cast.find(s=>s.fx==='spearAcid');assert.equal(spear.finish,'acid');assert.equal(plate('spearAcid',spear.finish),plate('acidSpray','acid'));
console.log('Magic plates, drops on hit/miss, school isolation, aura and spear routing OK');
