// Spatial rules for these two abilities; no inferred token from unrelated selections.
const named=s=>typeof s==='string' && s.trim().normalize('NFC').toLowerCase()==='ядро';
export function findCore(items,boss,selection=[]){
 const choices=items.filter(i=>i.id!==boss && i.visible!==false && (named(i.name)||named(i.text?.plainText)));
 if(choices.length===1)return choices[0].id;
 const selected=choices.filter(i=>selection.includes(i.id));
 return selected.length===1?selected[0].id:choices.length?'ambiguous':null;
}
export function lensGeometry(H,B,length){const d=Math.hypot(B.x-H.x,B.y-H.y),u=d>1e-6?{x:(B.x-H.x)/d,y:(B.y-H.y)/d}:{x:1,y:0};
 return {u,center:{x:H.x+.5*length*u.x,y:H.y+.5*length*u.y},reaches:d-Math.max(0,B.r||0)<=length+.001};}
export const ERASE={total:7600,peak:5320,shrink:640};
