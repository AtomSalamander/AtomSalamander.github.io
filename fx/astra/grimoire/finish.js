// Art direction only. Rules, target selection and hit times belong to the ability catalogue.
const schools={
 fire:['firebolt','fireball'], life:['heal','laara-redemption-heal'], light:['bless','sacred-flame','laara-command','laara-word-shield','laara-pain-suppression','lens-shard'],
 shade:['niala-name-theft','justiciar-shadow-net','justiciar-net-pull','curse','boss-dusk','shadow-step','laara-dark-void','darkness'],
 mind:['guurdezh-swing-watch','laara-mind-blast'], ward:['shield','shield-spell','mage-armor'], stone:['armor-of-richter','bow-shot'],
 electric:['lightning-bolt'], storm:['rolen-resonance','rolen-seam','rolen-awakening','stun'], echo:['laara-silence'],prism:['chromatic-spear'],
};
const byId=Object.fromEntries(Object.entries(schools).flatMap(([type,ids])=>ids.map(id=>[id,type])));
const elemental={fire:'fire',cold:'ice',acid:'acid',poison:'venom',lightning:'electric',thunder:'echo',psychic:'mind',radiant:'light',necrotic:'shade'};
export const finish=(id,element)=>elemental[element]||byId[id]||'prism';
const pigments={ // body / specular / deepest shadow
 fire:['#fb622c','#fff1af','#441427'],ice:['#62cbed','#efffff','#203a64'],acid:['#bedc37','#f7ffb8','#344125'],venom:['#62b854','#d8ffab','#21392c'],
 electric:['#3277ff','#ffe470','#222d55'], storm:['#6caaff','#efffff','#273156'],echo:['#a99bda','#edf0ff','#2a324e'],mind:['#d67de0','#ffe3ff','#381e4c'],
 life:['#65ce9d','#edffce','#1e473e'],light:['#f3bd64','#fff6cf','#67402d'],shade:['#9276bf','#d5c3fa','#171327'],
 ward:['#87c7ea','#f3fbff','#323658'],stone:['#ae9174','#ffe5bc','#3e3741'],prism:['#bb9feb','#fff2db','#343455']};
function rgb(c){let s=c.slice(1);if(s.length===3)s=[...s].map(x=>x+x).join('');const n=parseInt(s,16);return {x:(n>>16&255)/255,y:(n>>8&255)/255,z:(n&255)/255};}
function mix(a,b,k){a=rgb(a);b=rgb(b);return Object.fromEntries(['x','y','z'].map(c=>[c,a[c]+(b[c]-a[c])*k]));}
export function colors(o){const [body,hot,dark]=pigments[o.finish]||pigments.prism;const col=typeof o.color==='string'&&o.color[0]==='#'?o.color:body;
 return {dye:mix(col,body,.21),lit:mix(o.core||o.highlight||o.rune||o.color2||hot,hot,.34),ink:mix(o.dark||o.fillColor||dark,dark,.32)};}
